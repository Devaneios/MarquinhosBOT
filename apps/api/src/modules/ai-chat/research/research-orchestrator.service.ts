import type {
  researchJobViewSchema,
  researchStartResultSchema,
} from '@marquinhos/contracts/http/routes/aiChat';
import { Inject, Injectable } from '@nestjs/common';
import { getErrorMessage } from 'common/errors/error-handling';
import { logger } from 'common/logging/logger';
import { AI_RESEARCH_DAILY_QUOTA_SERVICE } from 'modules/ai-chat/ai-chat.tokens';
import { DailyQuotaService } from 'modules/ai-chat/daily-quota.service';
import { GuardrailService } from 'modules/ai-chat/guardrail.service';
import { DeepResearchService } from 'modules/ai-chat/research/deep-research.service';
import {
  ResearchJobStore,
  type ResearchJob,
} from 'modules/ai-chat/research/research-job.store';
import { ThreadSessionStore } from 'modules/ai-chat/thread/thread-session.store';
import { AiTraceRecorder } from 'modules/ai-chat/trace/ai-trace-recorder.service';
import type { z } from 'zod';

export interface StartResearchInput {
  threadId: string;
  guildId: string;
  channelId: string;
  userId: string;
  query: string;
  idempotencyKey: string;
}

export type StartResearchOutcome = z.input<typeof researchStartResultSchema>;

export type ResearchJobView = z.input<typeof researchJobViewSchema>;

/**
 * Owns the lifecycle of a deep research job: admission control, kicking the
 * pipeline off in the background, and recording progress so the bot can poll.
 *
 * The job runs detached on purpose. A full research pass takes minutes, far past
 * both the bot's HTTP timeout and Discord's interaction token, so the request
 * that starts it must return immediately.
 */
@Injectable()
export class ResearchOrchestrator {
  constructor(
    private readonly jobStore: ResearchJobStore,
    private readonly research: DeepResearchService,
    @Inject(AI_RESEARCH_DAILY_QUOTA_SERVICE)
    private readonly rateLimitService: DailyQuotaService,
    private readonly guardrailService: GuardrailService,
    private readonly threadStore: ThreadSessionStore,
    private readonly traceRecorder: AiTraceRecorder,
  ) {}

  async start(input: StartResearchInput): Promise<StartResearchOutcome> {
    if (this.guardrailService.isInjectionAttempt(input.query)) {
      return {
        status: 'rejected',
        reply:
          'Trouxa, eu sou filho do Rei :P Manda um tema de pesquisa de verdade.',
      };
    }

    const existing = await this.jobStore.create({
      idempotencyKey: input.idempotencyKey,
      threadId: input.threadId,
      userId: input.userId,
      guildId: input.guildId,
      channelId: input.channelId,
      query: input.query,
    });

    // A repeated idempotency key is a retry of a request we already accepted,
    // so it must not burn another slot on the daily limit.
    if (!existing.created) {
      return { status: 'accepted', jobId: existing.job.jobId, created: false };
    }

    if (
      !(await this.rateLimitService.checkAndIncrement(
        input.userId,
        input.guildId,
      ))
    ) {
      await this.jobStore.fail(existing.job.jobId, 'rate_limited');
      logger.info('ai.research.rate_limited', {
        userId: input.userId,
        guildId: input.guildId,
      });
      return { status: 'rate_limited' };
    }

    await this.threadStore.register({
      threadId: input.threadId,
      guildId: input.guildId,
      channelId: input.channelId,
      ownerUserId: input.userId,
      mode: 'research',
    });

    // Marked before responding so the first poll already sees 'running'.
    await this.jobStore.markRunning(existing.job.jobId);
    void this.execute(existing.job);

    return { status: 'accepted', jobId: existing.job.jobId, created: true };
  }

  async get(jobId: string): Promise<ResearchJobView | null> {
    const job = await this.jobStore.get(jobId);
    if (!job) return null;
    return { ...job, progress: await this.jobStore.events(jobId) };
  }

  /** Fails jobs orphaned by a process restart so no poller waits forever. */
  async reapStaleJobs(): Promise<void> {
    for (const job of await this.jobStore.findStale()) {
      await this.jobStore.fail(
        job.jobId,
        'A API reiniciou no meio da pesquisa. Roda o comando de novo.',
      );
      logger.warn('ai.research.job_reaped', { jobId: job.jobId });
    }
  }

  /**
   * Writes the finished report into the thread transcript. Without this a
   * follow-up question in a research thread would reach the model with no idea
   * what report it is being asked about.
   */
  private async seedThreadTranscript(
    job: ResearchJob,
    result: {
      report: string;
      sources: { index: number; url: string; title: string }[];
    },
  ): Promise<void> {
    const sourceList = result.sources
      .map((source) => `[${source.index}] ${source.title} — ${source.url}`)
      .join('\n');
    try {
      await this.threadStore.append(job.threadId, [
        {
          role: 'user',
          content: `Faz uma pesquisa profunda sobre: ${job.query}`,
        },
        {
          role: 'assistant',
          content: sourceList
            ? `${result.report}\n\n## Fontes\n${sourceList}`
            : result.report,
        },
      ]);
    } catch (error) {
      logger.warn('ai.research.thread_seed_failed', {
        jobId: job.jobId,
        error: getErrorMessage(error),
      });
    }
  }

  private async execute(job: ResearchJob): Promise<void> {
    const trace = this.traceRecorder.start({
      userId: job.userId,
      guildId: job.guildId,
      channelId: job.channelId,
      content: job.query,
      recentMessages: [],
    });

    logger.info('ai.research.job_started', {
      jobId: job.jobId,
      traceId: trace.traceId,
      threadId: job.threadId,
    });

    // Progress writes are chained so they keep their order, and drained
    // before the job is marked done so a poller never sees 'done' first.
    let progressWrites: Promise<void> = Promise.resolve();
    try {
      const result = await this.research.run({
        query: job.query,
        trace,
        onProgress: (stage, message) => {
          progressWrites = progressWrites
            .then(() => this.jobStore.addEvent(job.jobId, stage, message))
            .catch((error: unknown) => {
              // Losing a progress line must never abort the research itself.
              logger.warn('ai.research.progress_persist_failed', {
                jobId: job.jobId,
                error: getErrorMessage(error),
              });
            });
        },
      });

      await progressWrites;
      await this.jobStore.complete(job.jobId, result);
      await this.seedThreadTranscript(job, result);
      trace.finish({
        status: 'ok',
        mainCategory: 'agent_task',
        category: 'agent_task',
        reply: result.report,
        format: 'embed',
        iterations: result.stats.rounds,
        toolCallsUsed: result.stats.searches + result.stats.fetched,
      });
      logger.info('ai.research.job_done', {
        jobId: job.jobId,
        traceId: trace.traceId,
        ...result.stats,
      });
    } catch (error) {
      const message = getErrorMessage(error);
      await progressWrites;
      await this.jobStore.fail(job.jobId, message).catch((failError) =>
        logger.error('ai.research.fail_persist_failed', {
          jobId: job.jobId,
          error: failError,
        }),
      );
      trace.finish({ status: 'error', error });
      logger.error('ai.research.job_failed', {
        jobId: job.jobId,
        traceId: trace.traceId,
        error,
      });
    }
  }
}
