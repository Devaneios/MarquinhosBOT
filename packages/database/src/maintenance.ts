import { and, eq, inArray, lt, sql } from 'drizzle-orm';
import type { Db } from './client';
import {
  aiResearchEvents,
  aiResearchJobs,
  aiThreadItems,
  aiThreadSessions,
  aiTraceEvents,
  aiTraces,
  mazeSessions,
  scrobblesQueue,
} from './schema';

const SCROBBLE_TTL_SECONDS = 600;
const SCROBBLE_CLEANUP_INTERVAL_MS = 60_000;
const AI_RETENTION_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAZE_ABANDON_AFTER_SECONDS = 7 * 24 * 60 * 60;

const traceRetentionDays = Number(process.env.AI_TRACE_RETENTION_DAYS ?? 14);
const researchRetentionDays = Number(
  process.env.AI_RESEARCH_RETENTION_DAYS ?? 14,
);
const threadRetentionDays = Number(process.env.AI_THREAD_RETENTION_DAYS ?? 30);

export async function cleanupScrobbleQueue(db: Db): Promise<void> {
  await db
    .delete(scrobblesQueue)
    .where(
      lt(
        scrobblesQueue.created_at,
        sql`extract(epoch from now())::bigint - ${SCROBBLE_TTL_SECONDS}`,
      ),
    );
}

export async function cleanupAiRetention(
  db: Db,
  now: number = Date.now(),
): Promise<void> {
  const traceCutoff = now - traceRetentionDays * DAY_MS;
  await db
    .delete(aiTraceEvents)
    .where(
      inArray(
        aiTraceEvents.trace_id,
        db
          .select({ id: aiTraces.trace_id })
          .from(aiTraces)
          .where(lt(aiTraces.created_at, traceCutoff)),
      ),
    );
  await db.delete(aiTraces).where(lt(aiTraces.created_at, traceCutoff));

  const researchCutoff = now - researchRetentionDays * DAY_MS;
  await db
    .delete(aiResearchEvents)
    .where(
      inArray(
        aiResearchEvents.job_id,
        db
          .select({ id: aiResearchJobs.job_id })
          .from(aiResearchJobs)
          .where(lt(aiResearchJobs.created_at, researchCutoff)),
      ),
    );
  await db
    .delete(aiResearchJobs)
    .where(lt(aiResearchJobs.created_at, researchCutoff));

  // A Discord thread auto-archives long before this; once nobody has spoken in
  // it for a month its transcript is dead weight.
  const threadCutoff = now - threadRetentionDays * DAY_MS;
  await db
    .delete(aiThreadItems)
    .where(
      inArray(
        aiThreadItems.thread_id,
        db
          .select({ id: aiThreadSessions.thread_id })
          .from(aiThreadSessions)
          .where(lt(aiThreadSessions.last_used_at, threadCutoff)),
      ),
    );
  await db
    .delete(aiThreadSessions)
    .where(lt(aiThreadSessions.last_used_at, threadCutoff));
}

export async function abandonStaleMazeSessions(db: Db): Promise<void> {
  const cutoff = Math.floor(Date.now() / 1000) - MAZE_ABANDON_AFTER_SECONDS;
  await db
    .update(mazeSessions)
    .set({ status: 'abandoned' })
    .where(
      and(
        eq(mazeSessions.status, 'active'),
        lt(mazeSessions.started_at, cutoff),
      ),
    );
}

/** Starts the periodic cleanup jobs; returns a function that stops them. */
export function startMaintenance(db: Db): () => void {
  abandonStaleMazeSessions(db).catch((err) =>
    console.error('Maze session cleanup error:', err),
  );

  const retention = setInterval(() => {
    cleanupAiRetention(db).catch((err) =>
      console.error('AI trace retention cleanup error:', err),
    );
  }, AI_RETENTION_CLEANUP_INTERVAL_MS);

  const scrobbles = setInterval(() => {
    cleanupScrobbleQueue(db).catch((err) =>
      console.error('Scrobble queue TTL cleanup error:', err),
    );
  }, SCROBBLE_CLEANUP_INTERVAL_MS);

  return () => {
    clearInterval(retention);
    clearInterval(scrobbles);
  };
}
