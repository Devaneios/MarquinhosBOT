import { Database } from 'bun:sqlite';
import { randomUUID } from 'crypto';
import { db as defaultDb } from 'database/sqlite';

export type ResearchJobStatus = 'queued' | 'running' | 'done' | 'error';

export interface ResearchSource {
  index: number;
  url: string;
  title: string;
  publishedDate?: string;
}

export interface ResearchStats {
  rounds: number;
  searches: number;
  fetched: number;
  relevantSources: number;
  /** How far the follow-up recursion went: 0 when only the plan was searched. */
  maxDepth: number;
  durationMs: number;
  truncatedByBudget?: boolean;
}

export interface ResearchProgressEvent {
  seq: number;
  stage: string;
  message: string;
  createdAt: number;
}

export interface ResearchJob {
  jobId: string;
  threadId: string;
  userId: string;
  guildId: string;
  channelId: string;
  query: string;
  status: ResearchJobStatus;
  report?: string;
  sources?: ResearchSource[];
  stats?: ResearchStats;
  error?: string;
  createdAt: number;
  finishedAt?: number;
}

export interface CreateJobInput {
  idempotencyKey: string;
  threadId: string;
  userId: string;
  guildId: string;
  channelId: string;
  query: string;
}

export interface CreateJobOutcome {
  job: ResearchJob;
  /** False when an existing job was returned for a repeated idempotency key. */
  created: boolean;
}

interface JobRow {
  job_id: string;
  thread_id: string;
  user_id: string;
  guild_id: string;
  channel_id: string;
  query: string;
  status: ResearchJobStatus;
  report: string | null;
  sources: string | null;
  stats: string | null;
  error: string | null;
  created_at: number;
  finished_at: number | null;
}

function parseJson<T>(raw: string | null): T | undefined {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

function toJob(row: JobRow): ResearchJob {
  return {
    jobId: row.job_id,
    threadId: row.thread_id,
    userId: row.user_id,
    guildId: row.guild_id,
    channelId: row.channel_id,
    query: row.query,
    status: row.status,
    ...(row.report ? { report: row.report } : {}),
    ...(parseJson<ResearchSource[]>(row.sources)
      ? { sources: parseJson<ResearchSource[]>(row.sources) }
      : {}),
    ...(parseJson<ResearchStats>(row.stats)
      ? { stats: parseJson<ResearchStats>(row.stats) }
      : {}),
    ...(row.error ? { error: row.error } : {}),
    createdAt: row.created_at,
    ...(row.finished_at ? { finishedAt: row.finished_at } : {}),
  };
}

export class ResearchJobStore {
  constructor(private db: Database = defaultDb) {}

  /**
   * Creates a job, or returns the existing one when the same idempotency key
   * comes back. The bot's HTTP client retries on 5xx and timeout, so without
   * this a single slash command could kick off several eight-minute jobs.
   */
  create(input: CreateJobInput): CreateJobOutcome {
    const existing = this.db
      .query<JobRow, { $key: string }>(
        'SELECT * FROM ai_research_jobs WHERE idempotency_key = $key',
      )
      .get({ $key: input.idempotencyKey });
    if (existing) return { job: toJob(existing), created: false };

    const jobId = randomUUID();
    this.db
      .query(
        `INSERT INTO ai_research_jobs
           (job_id, idempotency_key, thread_id, user_id, guild_id, channel_id, query, status, created_at)
         VALUES ($jobId, $key, $threadId, $userId, $guildId, $channelId, $query, 'queued', $createdAt)`,
      )
      .run({
        $jobId: jobId,
        $key: input.idempotencyKey,
        $threadId: input.threadId,
        $userId: input.userId,
        $guildId: input.guildId,
        $channelId: input.channelId,
        $query: input.query,
        $createdAt: Date.now(),
      });

    return { job: this.get(jobId)!, created: true };
  }

  get(jobId: string): ResearchJob | null {
    const row = this.db
      .query<JobRow, { $jobId: string }>(
        'SELECT * FROM ai_research_jobs WHERE job_id = $jobId',
      )
      .get({ $jobId: jobId });
    return row ? toJob(row) : null;
  }

  markRunning(jobId: string): void {
    this.db
      .query(
        "UPDATE ai_research_jobs SET status = 'running' WHERE job_id = $jobId",
      )
      .run({ $jobId: jobId });
  }

  complete(
    jobId: string,
    result: { report: string; sources: ResearchSource[]; stats: ResearchStats },
  ): void {
    this.db
      .query(
        `UPDATE ai_research_jobs SET
           status = 'done', report = $report, sources = $sources,
           stats = $stats, finished_at = $finishedAt
         WHERE job_id = $jobId`,
      )
      .run({
        $jobId: jobId,
        $report: result.report,
        $sources: JSON.stringify(result.sources),
        $stats: JSON.stringify(result.stats),
        $finishedAt: Date.now(),
      });
  }

  fail(jobId: string, error: string): void {
    this.db
      .query(
        `UPDATE ai_research_jobs SET
           status = 'error', error = $error, finished_at = $finishedAt
         WHERE job_id = $jobId`,
      )
      .run({ $jobId: jobId, $error: error, $finishedAt: Date.now() });
  }

  addEvent(jobId: string, stage: string, message: string): void {
    const row = this.db
      .query<{ maxSeq: number | null }, { $jobId: string }>(
        'SELECT MAX(seq) AS maxSeq FROM ai_research_events WHERE job_id = $jobId',
      )
      .get({ $jobId: jobId });
    this.db
      .query(
        `INSERT INTO ai_research_events (job_id, seq, stage, message, created_at)
         VALUES ($jobId, $seq, $stage, $message, $createdAt)`,
      )
      .run({
        $jobId: jobId,
        $seq: (row?.maxSeq ?? 0) + 1,
        $stage: stage,
        $message: message,
        $createdAt: Date.now(),
      });
  }

  /** Progress events in order; `afterSeq` lets a poller fetch only new ones. */
  events(jobId: string, afterSeq = 0): ResearchProgressEvent[] {
    return this.db
      .query<
        { seq: number; stage: string; message: string; created_at: number },
        { $jobId: string; $afterSeq: number }
      >(
        `SELECT seq, stage, message, created_at FROM ai_research_events
         WHERE job_id = $jobId AND seq > $afterSeq ORDER BY seq ASC`,
      )
      .all({ $jobId: jobId, $afterSeq: afterSeq })
      .map((row) => ({
        seq: row.seq,
        stage: row.stage,
        message: row.message,
        createdAt: row.created_at,
      }));
  }

  /** Jobs left mid-flight by a process restart, so boot can fail them cleanly. */
  findStale(): ResearchJob[] {
    return this.db
      .query<JobRow, []>(
        "SELECT * FROM ai_research_jobs WHERE status IN ('queued','running')",
      )
      .all()
      .map(toJob);
  }
}
