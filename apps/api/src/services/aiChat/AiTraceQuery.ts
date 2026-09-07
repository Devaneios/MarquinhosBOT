import { Database } from 'bun:sqlite';
import { db as defaultDb } from 'database/sqlite';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export interface AiTraceRow {
  trace_id: string;
  user_id: string;
  guild_id: string;
  channel_id: string;
  content: string;
  main_category: string | null;
  category: string | null;
  status: string | null;
  reply: string | null;
  format: string | null;
  error: string | null;
  iterations: number;
  tool_calls_used: number;
  prompt_tokens: number;
  completion_tokens: number;
  duration_ms: number | null;
  created_at: number;
}

export interface AiTraceEventRow {
  seq: number;
  type: string;
  phase: string | null;
  name: string | null;
  input: string | null;
  output: string | null;
  status: string | null;
  exit_code: number | null;
  duration_ms: number | null;
  created_at: number;
}

export interface AiTraceListFilters {
  limit?: number;
  userId?: string;
  status?: string;
  category?: string;
}

export class AiTraceQuery {
  constructor(private db: Database = defaultDb) {}

  list(filters: AiTraceListFilters = {}): AiTraceRow[] {
    const limit = Math.min(
      Math.max(filters.limit ?? DEFAULT_LIMIT, 1),
      MAX_LIMIT,
    );
    return this.db
      .query<AiTraceRow, Record<string, string | number | null>>(
        `SELECT * FROM ai_traces
         WHERE ($userId IS NULL OR user_id = $userId)
           AND ($status IS NULL OR status = $status)
           AND ($category IS NULL OR category = $category)
         ORDER BY created_at DESC
         LIMIT $limit`,
      )
      .all({
        $userId: filters.userId ?? null,
        $status: filters.status ?? null,
        $category: filters.category ?? null,
        $limit: limit,
      });
  }

  get(
    traceId: string,
  ): { trace: AiTraceRow; events: AiTraceEventRow[] } | undefined {
    const trace = this.db
      .query<AiTraceRow, { $traceId: string }>(
        'SELECT * FROM ai_traces WHERE trace_id = $traceId',
      )
      .get({ $traceId: traceId });
    if (!trace) return undefined;

    const events = this.db
      .query<AiTraceEventRow, { $traceId: string }>(
        `SELECT seq, type, phase, name, input, output, status, exit_code, duration_ms, created_at
         FROM ai_trace_events WHERE trace_id = $traceId ORDER BY seq`,
      )
      .all({ $traceId: traceId });

    return { trace, events };
  }
}
