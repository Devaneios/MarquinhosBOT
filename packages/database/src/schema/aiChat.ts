import { sql } from 'drizzle-orm';
import {
  bigint,
  bigserial,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
} from 'drizzle-orm/pg-core';

export const aiChatConfig = pgTable('ai_chat_config', {
  key: text('key').primaryKey(),
  value: integer('value').notNull(),
});

const usageColumns = {
  user_id: text('user_id').notNull(),
  guild_id: text('guild_id').notNull(),
  usage_date: text('usage_date').notNull(),
  count: integer('count').notNull().default(0),
};

export const aiChatUsage = pgTable('ai_chat_usage', usageColumns, (t) => [
  primaryKey({ columns: [t.user_id, t.guild_id, t.usage_date] }),
]);

export const aiAgentUsage = pgTable('ai_agent_usage', usageColumns, (t) => [
  primaryKey({ columns: [t.user_id, t.guild_id, t.usage_date] }),
]);

export const aiResearchUsage = pgTable(
  'ai_research_usage',
  usageColumns,
  (t) => [primaryKey({ columns: [t.user_id, t.guild_id, t.usage_date] })],
);

export const aiChatGlobalUsage = pgTable(
  'ai_chat_global_usage',
  {
    guild_id: text('guild_id').notNull(),
    usage_date: text('usage_date').notNull(),
    count: integer('count').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.guild_id, t.usage_date] })],
);

export const agentSandboxSessions = pgTable(
  'agent_sandbox_sessions',
  {
    user_id: text('user_id').notNull(),
    guild_id: text('guild_id').notNull(),
    channel_id: text('channel_id').notNull(),
    container_id: text('container_id').notNull(),
    status: text('status').notNull().default('running'),
    created_at: bigint('created_at', { mode: 'number' }).notNull(),
    last_used_at: bigint('last_used_at', { mode: 'number' }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.user_id, t.channel_id] }),
    index('idx_agent_sandbox_sessions_status').on(t.status, t.last_used_at),
  ],
);

export const aiTraces = pgTable(
  'ai_traces',
  {
    trace_id: text('trace_id').primaryKey(),
    user_id: text('user_id').notNull(),
    guild_id: text('guild_id').notNull(),
    channel_id: text('channel_id').notNull(),
    content: text('content').notNull(),
    main_category: text('main_category'),
    category: text('category'),
    status: text('status'),
    reply: text('reply'),
    format: text('format'),
    error: text('error'),
    iterations: integer('iterations').notNull().default(0),
    tool_calls_used: integer('tool_calls_used').notNull().default(0),
    prompt_tokens: integer('prompt_tokens').notNull().default(0),
    completion_tokens: integer('completion_tokens').notNull().default(0),
    duration_ms: bigint('duration_ms', { mode: 'number' }),
    created_at: bigint('created_at', { mode: 'number' }).notNull(),
  },
  (t) => [index('idx_ai_traces_created_at').on(t.created_at)],
);

export const aiTraceEvents = pgTable(
  'ai_trace_events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    trace_id: text('trace_id').notNull(),
    seq: integer('seq').notNull(),
    type: text('type').notNull(),
    phase: text('phase'),
    name: text('name'),
    input: text('input'),
    output: text('output'),
    status: text('status'),
    exit_code: integer('exit_code'),
    duration_ms: bigint('duration_ms', { mode: 'number' }),
    created_at: bigint('created_at', { mode: 'number' }).notNull(),
  },
  (t) => [index('idx_ai_trace_events_trace').on(t.trace_id, t.seq)],
);

export const aiThreadSessions = pgTable(
  'ai_thread_sessions',
  {
    thread_id: text('thread_id').primaryKey(),
    guild_id: text('guild_id').notNull(),
    channel_id: text('channel_id').notNull(),
    owner_user_id: text('owner_user_id').notNull(),
    mode: text('mode').notNull(),
    status: text('status').notNull().default('active'),
    turn_count: integer('turn_count').notNull().default(0),
    created_at: bigint('created_at', { mode: 'number' }).notNull(),
    last_used_at: bigint('last_used_at', { mode: 'number' }).notNull(),
  },
  (t) => [
    check(
      'ai_thread_sessions_mode_check',
      sql`${t.mode} IN ('ask','research')`,
    ),
    check(
      'ai_thread_sessions_status_check',
      sql`${t.status} IN ('active','closed')`,
    ),
    index('idx_ai_thread_sessions_last_used').on(t.last_used_at),
  ],
);

export const aiThreadItems = pgTable(
  'ai_thread_items',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    thread_id: text('thread_id').notNull(),
    seq: integer('seq').notNull(),
    item_json: text('item_json').notNull(),
    created_at: bigint('created_at', { mode: 'number' }).notNull(),
  },
  (t) => [index('idx_ai_thread_items_thread').on(t.thread_id, t.seq)],
);

export const aiResearchJobs = pgTable(
  'ai_research_jobs',
  {
    job_id: text('job_id').primaryKey(),
    idempotency_key: text('idempotency_key').notNull().unique(),
    thread_id: text('thread_id').notNull(),
    user_id: text('user_id').notNull(),
    guild_id: text('guild_id').notNull(),
    channel_id: text('channel_id').notNull(),
    query: text('query').notNull(),
    status: text('status').notNull().default('queued'),
    report: text('report'),
    sources: text('sources'),
    stats: text('stats'),
    error: text('error'),
    created_at: bigint('created_at', { mode: 'number' }).notNull(),
    finished_at: bigint('finished_at', { mode: 'number' }),
  },
  (t) => [
    check(
      'ai_research_jobs_status_check',
      sql`${t.status} IN ('queued','running','done','error')`,
    ),
    index('idx_ai_research_jobs_created_at').on(t.created_at),
  ],
);

export const aiResearchEvents = pgTable(
  'ai_research_events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    job_id: text('job_id').notNull(),
    seq: integer('seq').notNull(),
    stage: text('stage').notNull(),
    message: text('message').notNull(),
    created_at: bigint('created_at', { mode: 'number' }).notNull(),
  },
  (t) => [index('idx_ai_research_events_job').on(t.job_id, t.seq)],
);
