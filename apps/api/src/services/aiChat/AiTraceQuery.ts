import { db as defaultDb, type Db } from '@marquinhos/database/client';
import { aiTraceEvents, aiTraces } from '@marquinhos/database/schema';
import { and, asc, desc, eq, type SQL } from 'drizzle-orm';

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
  constructor(private db: Db = defaultDb) {}

  async list(filters: AiTraceListFilters = {}): Promise<AiTraceRow[]> {
    const limit = Math.min(
      Math.max(filters.limit ?? DEFAULT_LIMIT, 1),
      MAX_LIMIT,
    );
    const conditions: SQL[] = [];
    if (filters.userId) conditions.push(eq(aiTraces.user_id, filters.userId));
    if (filters.status) conditions.push(eq(aiTraces.status, filters.status));
    if (filters.category)
      conditions.push(eq(aiTraces.category, filters.category));
    return this.db
      .select()
      .from(aiTraces)
      .where(and(...conditions))
      .orderBy(desc(aiTraces.created_at))
      .limit(limit);
  }

  async get(
    traceId: string,
  ): Promise<{ trace: AiTraceRow; events: AiTraceEventRow[] } | undefined> {
    const [trace] = await this.db
      .select()
      .from(aiTraces)
      .where(eq(aiTraces.trace_id, traceId));
    if (!trace) return undefined;

    const events = await this.db
      .select({
        seq: aiTraceEvents.seq,
        type: aiTraceEvents.type,
        phase: aiTraceEvents.phase,
        name: aiTraceEvents.name,
        input: aiTraceEvents.input,
        output: aiTraceEvents.output,
        status: aiTraceEvents.status,
        exit_code: aiTraceEvents.exit_code,
        duration_ms: aiTraceEvents.duration_ms,
        created_at: aiTraceEvents.created_at,
      })
      .from(aiTraceEvents)
      .where(eq(aiTraceEvents.trace_id, traceId))
      .orderBy(asc(aiTraceEvents.seq));

    return { trace, events };
  }
}
