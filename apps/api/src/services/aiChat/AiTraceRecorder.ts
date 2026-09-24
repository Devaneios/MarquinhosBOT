import { db as defaultDb, type Db } from '@marquinhos/database/client';
import { aiTraceEvents, aiTraces } from '@marquinhos/database/schema';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { DrizzleQueryError } from 'drizzle-orm/errors';
import type { AiChatRequest } from 'services/aiChat/types';
import { getErrorMessage } from 'utils/errorHandling';
import { isLevelEnabled, logger, type LogFields } from 'utils/logger';

export interface TraceUsage {
  promptTokens: number;
  completionTokens: number;
}

export interface TraceLlmEvent {
  phase: string;
  model: string;
  messages: unknown;
  output: unknown;
  usage?: TraceUsage;
  durationMs: number;
  error?: unknown;
}

export interface TraceToolEvent {
  name: string;
  iteration: number;
  rawArguments: string;
  args?: unknown;
  result?: string;
  status: 'success' | 'error';
  error?: string;
  durationMs: number;
}

export interface TraceExecEvent {
  containerId: string;
  argv: string[];
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
}

export interface TraceSandboxEvent {
  action: string;
  containerId?: string;
  durationMs?: number;
  error?: unknown;
}

export interface TraceSummary {
  status: string;
  mainCategory?: string;
  category?: string;
  reply?: string;
  format?: string;
  error?: unknown;
  iterations?: number;
  toolCallsUsed?: number;
}

export interface TraceContext {
  readonly traceId: string;
  llm(event: TraceLlmEvent): void;
  tool(event: TraceToolEvent): void;
  exec(event: TraceExecEvent): void;
  sandbox(event: TraceSandboxEvent): void;
  finish(summary: TraceSummary): void;
}

export const NOOP_TRACE: TraceContext = {
  traceId: '',
  llm: () => undefined,
  tool: () => undefined,
  exec: () => undefined,
  sandbox: () => undefined,
  finish: () => undefined,
};

function isEnabled(): boolean {
  return process.env.AI_TRACE_ENABLED?.toLowerCase() !== 'false';
}

function describeError(error: unknown): string | undefined {
  if (error === undefined || error === null) return undefined;
  // A query error's stack repeats its message, bound parameters included.
  if (error instanceof DrizzleQueryError) return getErrorMessage(error);
  if (error instanceof Error) return `${error.message}\n${error.stack ?? ''}`;
  return String(error);
}

function stringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? 'null';
  } catch (error) {
    return JSON.stringify({ serializationError: getErrorMessage(error) });
  }
}

class RecordedTrace implements TraceContext {
  private seq = 0;
  private promptTokens = 0;
  private completionTokens = 0;
  private readonly startedAt = Date.now();

  // Writes for one trace are chained so they land in order: the ai_traces
  // insert first, then events, then the finishing update. Callers never wait.
  private pending: Promise<void>;

  constructor(
    readonly traceId: string,
    private db: Db,
    created: Promise<void>,
    private onFinished: (trace: RecordedTrace) => void,
  ) {
    this.pending = created;
  }

  get settled(): Promise<void> {
    return this.pending;
  }

  llm(event: TraceLlmEvent): void {
    this.promptTokens += event.usage?.promptTokens ?? 0;
    this.completionTokens += event.usage?.completionTokens ?? 0;
    const seq = this.nextSeq();
    this.emit(
      'ai.llm.call',
      {
        seq,
        phase: event.phase,
        model: event.model,
        durationMs: event.durationMs,
        promptTokens: event.usage?.promptTokens,
        completionTokens: event.usage?.completionTokens,
        status: event.error ? 'error' : 'success',
        error: describeError(event.error),
      },
      { messages: event.messages, output: event.output },
    );
    this.insert({
      seq,
      type: 'llm_call',
      phase: event.phase,
      name: event.model,
      input: stringify({ messages: event.messages }),
      output: stringify({ output: event.output, usage: event.usage }),
      status: event.error ? 'error' : 'success',
      durationMs: event.durationMs,
    });
  }

  tool(event: TraceToolEvent): void {
    const seq = this.nextSeq();
    this.emit(
      'ai.tool.call',
      {
        seq,
        iteration: event.iteration,
        tool: event.name,
        status: event.status,
        durationMs: event.durationMs,
        resultChars: event.result?.length,
        error: event.error,
      },
      { rawArguments: event.rawArguments, result: event.result },
    );
    this.insert({
      seq,
      type: 'tool_call',
      phase: 'agent_loop',
      name: event.name,
      input: stringify({
        iteration: event.iteration,
        rawArguments: event.rawArguments,
        args: event.args,
      }),
      output: stringify({ result: event.result, error: event.error }),
      status: event.status,
      durationMs: event.durationMs,
    });
  }

  exec(event: TraceExecEvent): void {
    const seq = this.nextSeq();
    this.emit(
      'ai.sandbox.exec',
      {
        seq,
        containerId: event.containerId,
        exitCode: event.exitCode,
        durationMs: event.durationMs,
        stdoutChars: event.stdout.length,
        stderrChars: event.stderr.length,
      },
      { argv: event.argv, stdout: event.stdout, stderr: event.stderr },
    );
    this.insert({
      seq,
      type: 'exec',
      phase: 'agent_loop',
      name: event.argv[0],
      input: stringify({ containerId: event.containerId, argv: event.argv }),
      output: stringify({ stdout: event.stdout, stderr: event.stderr }),
      status: event.exitCode === 0 ? 'success' : 'error',
      exitCode: event.exitCode,
      durationMs: event.durationMs,
    });
  }

  sandbox(event: TraceSandboxEvent): void {
    const seq = this.nextSeq();
    const error = describeError(event.error);
    this.emit(
      'ai.sandbox.session',
      {
        seq,
        action: event.action,
        containerId: event.containerId,
        durationMs: event.durationMs,
        error,
      },
      {},
    );
    this.insert({
      seq,
      type: 'sandbox',
      phase: 'agent_loop',
      name: event.action,
      output: stringify({ containerId: event.containerId, error }),
      status: error ? 'error' : 'success',
      durationMs: event.durationMs,
    });
  }

  finish(summary: TraceSummary): void {
    const durationMs = Date.now() - this.startedAt;
    const error = describeError(summary.error);
    this.emit(
      'ai.trace.finish',
      {
        status: summary.status,
        mainCategory: summary.mainCategory,
        category: summary.category,
        format: summary.format,
        replyChars: summary.reply?.length,
        iterations: summary.iterations,
        toolCallsUsed: summary.toolCallsUsed,
        promptTokens: this.promptTokens,
        completionTokens: this.completionTokens,
        durationMs,
        error,
      },
      { reply: summary.reply },
    );
    const update = {
      main_category: summary.mainCategory ?? null,
      category: summary.category ?? null,
      status: summary.status,
      reply: summary.reply ?? null,
      format: summary.format ?? null,
      error: error ?? null,
      iterations: summary.iterations ?? 0,
      tool_calls_used: summary.toolCallsUsed ?? 0,
      prompt_tokens: this.promptTokens,
      completion_tokens: this.completionTokens,
      duration_ms: durationMs,
    };
    this.enqueue(async () => {
      await this.db
        .update(aiTraces)
        .set(update)
        .where(eq(aiTraces.trace_id, this.traceId));
    });
    void this.pending.then(() => this.onFinished(this));
  }

  private nextSeq(): number {
    return ++this.seq;
  }

  private emit(event: string, summary: LogFields, payload: LogFields): void {
    const fields = { traceId: this.traceId, ...summary };
    if (isLevelEnabled('debug')) {
      logger.debug(event, { ...fields, ...payload });
    } else {
      logger.info(event, fields);
    }
  }

  private insert(event: {
    seq: number;
    type: string;
    phase?: string;
    name?: string;
    input?: string;
    output?: string;
    status?: string;
    exitCode?: number;
    durationMs?: number;
  }): void {
    const row = {
      trace_id: this.traceId,
      seq: event.seq,
      type: event.type,
      phase: event.phase ?? null,
      name: event.name ?? null,
      input: event.input ?? null,
      output: event.output ?? null,
      status: event.status ?? null,
      exit_code: event.exitCode ?? null,
      duration_ms: event.durationMs ?? null,
      created_at: Date.now(),
    };
    this.enqueue(async () => {
      await this.db.insert(aiTraceEvents).values(row);
    });
  }

  private enqueue(write: () => Promise<void>): void {
    this.pending = this.pending.then(write).catch((error: unknown) => {
      logger.warn('ai.trace.persist_failed', {
        traceId: this.traceId,
        error: describeError(error),
      });
    });
  }
}

export class AiTraceRecorder {
  private readonly open = new Set<RecordedTrace>();

  constructor(private db: Db = defaultDb) {}

  start(request: AiChatRequest): TraceContext {
    if (!isEnabled()) return NOOP_TRACE;

    const traceId = randomUUID();
    const created = this.db
      .insert(aiTraces)
      .values({
        trace_id: traceId,
        user_id: request.userId,
        guild_id: request.guildId,
        channel_id: request.channelId,
        content: request.content,
        created_at: Date.now(),
      })
      .then(
        () => undefined,
        (error: unknown) => {
          logger.warn('ai.trace.persist_failed', {
            traceId,
            error: describeError(error),
          });
        },
      );

    logger.info('ai.trace.start', {
      traceId,
      userId: request.userId,
      guildId: request.guildId,
      channelId: request.channelId,
      contentChars: request.content.length,
      recentMessages: request.recentMessages.length,
      hasRepliedMessage: Boolean(request.repliedMessage),
      content: isLevelEnabled('debug') ? request.content : undefined,
    });

    // Kept only until its last write lands, so flush() can wait for it.
    const trace = new RecordedTrace(traceId, this.db, created, (finished) =>
      this.open.delete(finished),
    );
    this.open.add(trace);
    return trace;
  }

  /** Waits for every write queued so far (tests, graceful shutdown). */
  async flush(): Promise<void> {
    const traces = [...this.open];
    this.open.clear();
    await Promise.all(traces.map((trace) => trace.settled));
  }
}
