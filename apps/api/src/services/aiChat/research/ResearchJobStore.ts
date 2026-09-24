import {
  researchJobStatusSchema,
  researchSourceSchema,
  researchStatsSchema,
  type ResearchProgressEvent,
  type ResearchSource,
  type ResearchStats,
} from '@marquinhos/contracts/http/routes/aiChat';
import { db as defaultDb, type Db } from '@marquinhos/database/client';
import { aiResearchEvents, aiResearchJobs } from '@marquinhos/database/schema';
import { randomUUID } from 'crypto';
import { and, asc, eq, gt, inArray, max } from 'drizzle-orm';
import { z } from 'zod';

export type ResearchJobStatus = z.output<typeof researchJobStatusSchema>;

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

function parseJson<T>(raw: string | null, schema: z.ZodType<T>): T | undefined {
  if (!raw) return undefined;
  try {
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

function toJob(row: typeof aiResearchJobs.$inferSelect): ResearchJob {
  return {
    jobId: row.job_id,
    threadId: row.thread_id,
    userId: row.user_id,
    guildId: row.guild_id,
    channelId: row.channel_id,
    query: row.query,
    status: row.status as ResearchJobStatus,
    ...(row.report ? { report: row.report } : {}),
    ...(parseJson(row.sources, z.array(researchSourceSchema))
      ? { sources: parseJson(row.sources, z.array(researchSourceSchema)) }
      : {}),
    ...(parseJson(row.stats, researchStatsSchema)
      ? { stats: parseJson(row.stats, researchStatsSchema) }
      : {}),
    ...(row.error ? { error: row.error } : {}),
    createdAt: row.created_at,
    ...(row.finished_at ? { finishedAt: row.finished_at } : {}),
  };
}

export class ResearchJobStore {
  constructor(private db: Db = defaultDb) {}

  /**
   * Creates a job, or returns the existing one when the same idempotency key
   * comes back. The bot's HTTP client retries on 5xx and timeout, so without
   * this a single slash command could kick off several eight-minute jobs.
   */
  async create(input: CreateJobInput): Promise<CreateJobOutcome> {
    // The unique key settles concurrent retries: only one insert lands.
    const [inserted] = await this.db
      .insert(aiResearchJobs)
      .values({
        job_id: randomUUID(),
        idempotency_key: input.idempotencyKey,
        thread_id: input.threadId,
        user_id: input.userId,
        guild_id: input.guildId,
        channel_id: input.channelId,
        query: input.query,
        status: 'queued',
        created_at: Date.now(),
      })
      .onConflictDoNothing({ target: aiResearchJobs.idempotency_key })
      .returning();
    if (inserted) return { job: toJob(inserted), created: true };

    const [existing] = await this.db
      .select()
      .from(aiResearchJobs)
      .where(eq(aiResearchJobs.idempotency_key, input.idempotencyKey));
    return { job: toJob(existing!), created: false };
  }

  async get(jobId: string): Promise<ResearchJob | null> {
    const [row] = await this.db
      .select()
      .from(aiResearchJobs)
      .where(eq(aiResearchJobs.job_id, jobId));
    return row ? toJob(row) : null;
  }

  async markRunning(jobId: string): Promise<void> {
    await this.db
      .update(aiResearchJobs)
      .set({ status: 'running' })
      .where(eq(aiResearchJobs.job_id, jobId));
  }

  async complete(
    jobId: string,
    result: { report: string; sources: ResearchSource[]; stats: ResearchStats },
  ): Promise<void> {
    await this.db
      .update(aiResearchJobs)
      .set({
        status: 'done',
        report: result.report,
        sources: JSON.stringify(result.sources),
        stats: JSON.stringify(result.stats),
        finished_at: Date.now(),
      })
      .where(eq(aiResearchJobs.job_id, jobId));
  }

  async fail(jobId: string, error: string): Promise<void> {
    await this.db
      .update(aiResearchJobs)
      .set({ status: 'error', error, finished_at: Date.now() })
      .where(eq(aiResearchJobs.job_id, jobId));
  }

  async addEvent(jobId: string, stage: string, message: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      // Locking the job row serialises seq allocation for its events.
      await tx
        .select({ id: aiResearchJobs.job_id })
        .from(aiResearchJobs)
        .where(eq(aiResearchJobs.job_id, jobId))
        .for('update');
      const [row] = await tx
        .select({ maxSeq: max(aiResearchEvents.seq) })
        .from(aiResearchEvents)
        .where(eq(aiResearchEvents.job_id, jobId));
      await tx.insert(aiResearchEvents).values({
        job_id: jobId,
        seq: (row?.maxSeq ?? 0) + 1,
        stage,
        message,
        created_at: Date.now(),
      });
    });
  }

  /** Progress events in order; `afterSeq` lets a poller fetch only new ones. */
  async events(jobId: string, afterSeq = 0): Promise<ResearchProgressEvent[]> {
    const rows = await this.db
      .select({
        seq: aiResearchEvents.seq,
        stage: aiResearchEvents.stage,
        message: aiResearchEvents.message,
        created_at: aiResearchEvents.created_at,
      })
      .from(aiResearchEvents)
      .where(
        and(
          eq(aiResearchEvents.job_id, jobId),
          gt(aiResearchEvents.seq, afterSeq),
        ),
      )
      .orderBy(asc(aiResearchEvents.seq));
    return rows.map((row) => ({
      seq: row.seq,
      stage: row.stage,
      message: row.message,
      createdAt: row.created_at,
    }));
  }

  /** Jobs left mid-flight by a process restart, so boot can fail them cleanly. */
  async findStale(): Promise<ResearchJob[]> {
    const rows = await this.db
      .select()
      .from(aiResearchJobs)
      .where(inArray(aiResearchJobs.status, ['queued', 'running']));
    return rows.map(toJob);
  }
}
