import { AiTraceRecorder } from 'services/aiChat/AiTraceRecorder';
import { GuardrailService } from 'services/aiChat/GuardrailService';
import { DeepResearchService } from 'services/aiChat/research/DeepResearchService';
import {
  ResearchJobStore,
  type ResearchJob,
  type ResearchProgressEvent,
} from 'services/aiChat/research/ResearchJobStore';
import { ResearchRateLimitService } from 'services/aiChat/research/ResearchRateLimitService';
import { ThreadSessionStore } from 'services/aiChat/thread/ThreadSessionStore';
import { logger } from 'utils/logger';

export interface StartResearchInput {
  threadId: string;
  guildId: string;
  channelId: string;
  userId: string;
  query: string;
  idempotencyKey: string;
}

export type StartResearchOutcome =
  | { status: 'accepted'; jobId: string; created: boolean }
  | { status: 'rate_limited' }
  | { status: 'rejected'; reply: string };

export interface ResearchJobView extends ResearchJob {
  progress: ResearchProgressEvent[];
}

/**
 * Owns the lifecycle of a deep research job: admission control, kicking the
 * pipeline off in the background, and recording progress so the bot can poll.
 *
 * The job runs detached on purpose. A full research pass takes minutes, far past
 * both the bot's HTTP timeout and Discord's interaction token, so the request
 * that starts it must return immediately.
 */
export class ResearchOrchestrator {
  constructor(
    private jobStore: ResearchJobStore = new ResearchJobStore(),
    private research: DeepResearchService = new DeepResearchService(),
    private rateLimitService: ResearchRateLimitService = new ResearchRateLimitService(),
    private guardrailService: GuardrailService = new GuardrailService(),
    private threadStore: ThreadSessionStore = new ThreadSessionStore(),
    private traceRecorder: AiTraceRecorder = new AiTraceRecorder(),
  ) {}

  start(input: StartResearchInput): StartResearchOutcome {
    if (this.guardrailService.isInjectionAttempt(input.query)) {
      return {
        status: 'rejected',
        reply:
          'Trouxa, eu sou filho do Rei :P Manda um tema de pesquisa de verdade.',
      };
    }

    const existing = this.jobStore.create({
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

    if (!this.rateLimitService.checkAndIncrement(input.userId, input.guildId)) {
      this.jobStore.fail(existing.job.jobId, 'rate_limited');
      logger.info('ai.research.rate_limited', {
        userId: input.userId,
        guildId: input.guildId,
      });
      return { status: 'rate_limited' };
    }

    this.threadStore.register({
      threadId: input.threadId,
      guildId: input.guildId,
      channelId: input.channelId,
      ownerUserId: input.userId,
      mode: 'research',
    });

    void this.execute(existing.job);

    return { status: 'accepted', jobId: existing.job.jobId, created: true };
  }

  get(jobId: string): ResearchJobView | null {
    const job = this.jobStore.get(jobId);
    if (!job) return null;
    return { ...job, progress: this.jobStore.events(jobId) };
  }

  /** Fails jobs orphaned by a process restart so no poller waits forever. */
  reapStaleJobs(): void {
    for (const job of this.jobStore.findStale()) {
      this.jobStore.fail(
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
  private seedThreadTranscript(
    job: ResearchJob,
    result: {
      report: string;
      sources: { index: number; url: string; title: string }[];
    },
  ): void {
    const sourceList = result.sources
      .map((source) => `[${source.index}] ${source.title} — ${source.url}`)
      .join('\n');
    try {
      this.threadStore.append(job.threadId, [
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
        error: (error as Error).message,
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

    this.jobStore.markRunning(job.jobId);
    logger.info('ai.research.job_started', {
      jobId: job.jobId,
      traceId: trace.traceId,
      threadId: job.threadId,
    });

    try {
      const result = await this.research.run({
        query: job.query,
        trace,
        onProgress: (stage, message) => {
          try {
            this.jobStore.addEvent(job.jobId, stage, message);
          } catch (error) {
            // Losing a progress line must never abort the research itself.
            logger.warn('ai.research.progress_persist_failed', {
              jobId: job.jobId,
              error: (error as Error).message,
            });
          }
        },
      });

      this.jobStore.complete(job.jobId, result);
      this.seedThreadTranscript(job, result);
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
      const message = (error as Error).message;
      this.jobStore.fail(job.jobId, message);
      trace.finish({ status: 'error', error });
      logger.error('ai.research.job_failed', {
        jobId: job.jobId,
        traceId: trace.traceId,
        error,
      });
    }
  }
}
