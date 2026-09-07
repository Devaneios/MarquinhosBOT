import { Database } from 'bun:sqlite';
import { randomUUID } from 'crypto';
import { db as defaultDb } from 'database/sqlite';
import type { AiChatRequest } from 'services/aiChat/types';
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
  if (error instanceof Error) return `${error.message}\n${error.stack ?? ''}`;
  return String(error);
}

function stringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? 'null';
  } catch (error) {
    return JSON.stringify({ serializationError: (error as Error).message });
  }
}

class RecordedTrace implements TraceContext {
  private seq = 0;
  private promptTokens = 0;
  private completionTokens = 0;
  private readonly startedAt = Date.now();

  constructor(
    readonly traceId: string,
    private db: Database,
  ) {}

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
    this.run(
      `UPDATE ai_traces SET
         main_category = $mainCategory,
         category = $category,
         status = $status,
         reply = $reply,
         format = $format,
         error = $error,
         iterations = $iterations,
         tool_calls_used = $toolCallsUsed,
         prompt_tokens = $promptTokens,
         completion_tokens = $completionTokens,
         duration_ms = $durationMs
       WHERE trace_id = $traceId`,
      {
        $traceId: this.traceId,
        $mainCategory: summary.mainCategory ?? null,
        $category: summary.category ?? null,
        $status: summary.status,
        $reply: summary.reply ?? null,
        $format: summary.format ?? null,
        $error: error ?? null,
        $iterations: summary.iterations ?? 0,
        $toolCallsUsed: summary.toolCallsUsed ?? 0,
        $promptTokens: this.promptTokens,
        $completionTokens: this.completionTokens,
        $durationMs: durationMs,
      },
    );
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
    this.run(
      `INSERT INTO ai_trace_events
         (trace_id, seq, type, phase, name, input, output, status, exit_code, duration_ms, created_at)
       VALUES ($traceId, $seq, $type, $phase, $name, $input, $output, $status, $exitCode, $durationMs, $createdAt)`,
      {
        $traceId: this.traceId,
        $seq: event.seq,
        $type: event.type,
        $phase: event.phase ?? null,
        $name: event.name ?? null,
        $input: event.input ?? null,
        $output: event.output ?? null,
        $status: event.status ?? null,
        $exitCode: event.exitCode ?? null,
        $durationMs: event.durationMs ?? null,
        $createdAt: Date.now(),
      },
    );
  }

  private run(sql: string, params: Record<string, unknown>): void {
    try {
      this.db.query(sql).run(params as never);
    } catch (error) {
      logger.warn('ai.trace.persist_failed', {
        traceId: this.traceId,
        error: describeError(error),
      });
    }
  }
}

export class AiTraceRecorder {
  constructor(private db: Database = defaultDb) {}

  start(request: AiChatRequest): TraceContext {
    if (!isEnabled()) return NOOP_TRACE;

    const traceId = randomUUID();
    try {
      this.db
        .query(
          `INSERT INTO ai_traces
             (trace_id, user_id, guild_id, channel_id, content, created_at)
           VALUES ($traceId, $userId, $guildId, $channelId, $content, $createdAt)`,
        )
        .run({
          $traceId: traceId,
          $userId: request.userId,
          $guildId: request.guildId,
          $channelId: request.channelId,
          $content: request.content,
          $createdAt: Date.now(),
        });
    } catch (error) {
      logger.warn('ai.trace.persist_failed', {
        traceId,
        error: describeError(error),
      });
    }

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

    return new RecordedTrace(traceId, this.db);
  }
}
