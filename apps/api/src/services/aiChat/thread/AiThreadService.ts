import { ThreadAgentLoop } from 'services/aiChat/agent/ThreadAgentLoop';
import { ToolDispatcher } from 'services/aiChat/agent/ToolDispatcher';
import { AgentRateLimitService } from 'services/aiChat/AgentRateLimitService';
import {
  AiTraceRecorder,
  NOOP_TRACE,
  type TraceContext,
} from 'services/aiChat/AiTraceRecorder';
import { GuardrailService } from 'services/aiChat/GuardrailService';
import { ResponsesClient } from 'services/aiChat/llm/ResponsesClient';
import {
  GUARDRAIL_ROAST_PROMPT,
  THREAD_ASK_SYSTEM_PROMPT,
  THREAD_COMPACTION_PROMPT,
} from 'services/aiChat/prompts';
import { RateLimitService } from 'services/aiChat/RateLimitService';
import { DockerodeSandboxClient } from 'services/aiChat/sandbox/DockerodeSandboxClient';
import {
  SandboxCapacityError,
  SandboxManager,
} from 'services/aiChat/sandbox/SandboxManager';
import {
  ThreadSessionStore,
  type ThreadMode,
} from 'services/aiChat/thread/ThreadSessionStore';
import type { AiChatResult } from 'services/aiChat/types';
import { logger } from 'utils/logger';

const EMBED_THRESHOLD_CHARS = 1800;
const EMBED_TITLE = '🧵 Resposta';
const ROAST_MAX_TOKENS = 200;
const COMPACTION_MAX_TOKENS = 800;
const SANDBOX_UNAVAILABLE_REPLY =
  'Muita gente usando o sandbox agora. Tenta de novo em alguns minutos.';

export interface ThreadAskRequest {
  threadId: string;
  guildId: string;
  channelId: string;
  userId: string;
  content: string;
  mode?: ThreadMode;
}

/**
 * A single turn of an /ia perguntar thread. Bypasses the tag flow's
 * classification entirely: there is no category to pick here, the thread is
 * already known to be a question, and the transcript — reasoning included — is
 * what gives continuity across turns.
 */
export class AiThreadService {
  constructor(
    private store: ThreadSessionStore = new ThreadSessionStore(),
    private rateLimitService: RateLimitService = new RateLimitService(),
    private agentRateLimitService: AgentRateLimitService = new AgentRateLimitService(),
    private guardrailService: GuardrailService = new GuardrailService(),
    private responsesClient: ResponsesClient = new ResponsesClient(),
    private sandboxManager: SandboxManager = new SandboxManager(
      new DockerodeSandboxClient(),
    ),
    private traceRecorder: AiTraceRecorder = new AiTraceRecorder(),
    private agentLoop?: ThreadAgentLoop,
  ) {}

  private loop(): ThreadAgentLoop {
    this.agentLoop ??= new ThreadAgentLoop(
      new ToolDispatcher(this.sandboxManager),
      this.responsesClient,
    );
    return this.agentLoop;
  }

  async ask(request: ThreadAskRequest): Promise<AiChatResult> {
    if (
      !this.rateLimitService.checkAndIncrement(request.userId, request.guildId)
    ) {
      logger.info('ai.thread.rate_limited', {
        threadId: request.threadId,
        userId: request.userId,
        scope: 'chat',
      });
      return { status: 'rate_limited' };
    }

    const trace = this.traceRecorder.start({
      userId: request.userId,
      guildId: request.guildId,
      channelId: request.channelId,
      content: request.content,
      recentMessages: [],
    });

    try {
      if (this.guardrailService.isInjectionAttempt(request.content)) {
        return await this.roast(request, trace);
      }

      if (
        !this.agentRateLimitService.checkAndIncrement(
          request.userId,
          request.guildId,
        )
      ) {
        logger.info('ai.thread.rate_limited', {
          threadId: request.threadId,
          userId: request.userId,
          scope: 'agent',
        });
        trace.finish({ status: 'rate_limited', category: 'agent_task' });
        return { status: 'rate_limited' };
      }

      this.store.register({
        threadId: request.threadId,
        guildId: request.guildId,
        channelId: request.channelId,
        ownerUserId: request.userId,
        mode: request.mode ?? 'ask',
      });

      let containerId: string;
      const sessionStartedAt = Date.now();
      try {
        containerId = await this.sandboxManager.getOrCreateSession(
          request.userId,
          request.guildId,
          request.threadId,
        );
        trace.sandbox({
          action: 'session_acquired',
          containerId,
          durationMs: Date.now() - sessionStartedAt,
        });
      } catch (error) {
        trace.sandbox({
          action:
            error instanceof SandboxCapacityError
              ? 'session_at_capacity'
              : 'session_failed',
          durationMs: Date.now() - sessionStartedAt,
          error,
        });
        if (error instanceof SandboxCapacityError) {
          trace.finish({
            status: 'ok',
            category: 'agent_task',
            reply: SANDBOX_UNAVAILABLE_REPLY,
            format: 'text',
          });
          return {
            status: 'ok',
            category: 'agent_task',
            reply: SANDBOX_UNAVAILABLE_REPLY,
            format: 'text',
            traceId: trace.traceId || undefined,
          };
        }
        return Promise.reject(error);
      }

      await this.compactIfNeeded(request.threadId, trace);

      const outcome = await this.loop().run({
        instructions: THREAD_ASK_SYSTEM_PROMPT,
        transcript: this.store.loadTranscript(request.threadId),
        userContent: request.content,
        containerId,
        trace,
      });

      this.store.append(request.threadId, outcome.newItems);

      const reply = outcome.text.trim();
      const isLong = reply.length > EMBED_THRESHOLD_CHARS;
      const format = isLong ? 'embed' : 'text';

      logger.info('ai.thread.turn_end', {
        traceId: trace.traceId,
        threadId: request.threadId,
        reason: outcome.reason,
        iterations: outcome.iterations,
        toolCallsUsed: outcome.toolCallsUsed,
        replyChars: reply.length,
      });

      trace.finish({
        status: 'ok',
        mainCategory: 'agent_task',
        category: 'agent_task',
        reply,
        format,
        iterations: outcome.iterations,
        toolCallsUsed: outcome.toolCallsUsed,
      });

      return {
        status: 'ok',
        category: 'agent_task',
        reply,
        format,
        embedTitle: isLong ? EMBED_TITLE : undefined,
        traceId: trace.traceId || undefined,
      };
    } catch (error) {
      logger.error('ai.thread.turn_failed', {
        traceId: trace.traceId,
        threadId: request.threadId,
        error,
      });
      trace.finish({ status: 'error', error });
      return { status: 'error', traceId: trace.traceId || undefined };
    }
  }

  private async roast(
    request: ThreadAskRequest,
    trace: TraceContext,
  ): Promise<AiChatResult> {
    const response = await this.responsesClient.create({
      instructions: GUARDRAIL_ROAST_PROMPT,
      input: [{ role: 'user', content: request.content }],
      maxOutputTokens: ROAST_MAX_TOKENS,
      trace,
      phase: 'guardrail_roast',
    });
    const reply = response.text.trim();
    trace.finish({
      status: 'ok',
      category: 'guardrail_roast',
      reply,
      format: 'text',
    });
    return {
      status: 'ok',
      category: 'guardrail_roast',
      reply,
      format: 'text',
      traceId: trace.traceId || undefined,
    };
  }

  /**
   * A long-lived thread eventually outgrows the model's context window. When
   * that point is near, summarize the oldest turns and drop them — a failed
   * compaction is not fatal, so the turn proceeds on the full transcript and we
   * try again next time.
   */
  private async compactIfNeeded(
    threadId: string,
    trace: TraceContext = NOOP_TRACE,
  ): Promise<void> {
    if (!this.store.needsCompaction(threadId)) return;

    const doomed = this.store.itemsToCompact(threadId);
    if (doomed.length === 0) return;

    try {
      const response = await this.responsesClient.create({
        instructions: THREAD_COMPACTION_PROMPT,
        input: [
          {
            role: 'user',
            content: `<conversa trust_level="untrusted">\n${JSON.stringify(doomed)}\n</conversa>`,
          },
        ],
        maxOutputTokens: COMPACTION_MAX_TOKENS,
        trace,
        phase: 'thread_compaction',
      });
      const summary = response.text.trim();
      if (summary) this.store.compact(threadId, summary);
    } catch (error) {
      logger.warn('ai.thread.compaction_failed', {
        threadId,
        error: (error as Error).message,
      });
    }
  }
}
