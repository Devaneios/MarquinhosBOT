import { guessRowSchema } from '@marquinhos/contracts/wordle';
import type { Db } from '@marquinhos/database/client';
import {
  wordleCommunityDailyPresence,
  wordleCommunityParticipation,
  wordleCommunityWinAnnouncements,
  wordleDaily,
  wordleDays,
  wordleDrafts,
  wordleGlobalAchievements,
  wordleGlobalCutovers,
  wordleGlobalDays,
  wordleGlobalDiscoveries,
  wordleGlobalDrafts,
  wordleGlobalMigrationState,
  wordleGlobalOccurrences,
  wordleGlobalSessionOrigins,
  wordleGlobalSessions,
  wordleLegacyProgress,
  wordleSessions,
  wordleStreaks,
} from '@marquinhos/database/schema';
import { dayNumber } from '@marquinhos/domain/games/wordle/playerStats';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  verifyWordlePreservation,
  wordlePreservationDigest,
  type WordlePreservationReport,
} from './wordle-preservation';

class DryRunRollback extends Error {}

const optionsSchema = z.object({
  sourceTag: z.enum(['v0.0.3', 'fresh']),
  cutoverDate: z.string().refine(isIsoDate, 'Expected a valid ISO date'),
  dryRun: z.boolean().optional(),
  before: z.object({ version: z.literal(1) }).passthrough(),
});

function isIsoDate(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
  );
}

function cutoverPreviousDate(date: string): string {
  return new Date((dayNumber(date) - 1) * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

/** Atomically stores the progress anchor, community history, and receipt. */
export async function prepareGlobalWordleCutover(
  database: Db,
  input: {
    sourceTag: 'v0.0.3' | 'fresh';
    cutoverDate: string;
    dryRun?: boolean;
    before: WordlePreservationReport;
  },
): Promise<{
  status: 'prepared' | 'already-prepared' | 'dry-run';
  sourceDigest: string;
  cutoverDate: string;
}> {
  const parsed = optionsSchema.safeParse(input);
  if (!parsed.success)
    throw new Error(
      `Invalid global Wordle cutover options: ${parsed.error.issues.map((issue) => issue.message).join(', ')}`,
    );
  const sourceDigest = wordlePreservationDigest(input.before);

  try {
    return await database.transaction(async (tx) => {
      await tx.execute(sql`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`);
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended('wordle-global-cutover', 0))`,
      );

      const preservation = await verifyWordlePreservation(tx, input.before);
      if (!preservation.ok)
        throw new Error(
          `Global Wordle source changed: ${JSON.stringify(preservation.mismatches)}`,
        );

      const [previous] = await tx
        .select()
        .from(wordleGlobalCutovers)
        .where(eq(wordleGlobalCutovers.id, 'global-only-v003'));
      if (previous) {
        if (
          previous.source_tag !== input.sourceTag ||
          previous.cutover_date !== input.cutoverDate ||
          previous.source_digest !== sourceDigest
        )
          throw new Error(
            'Global Wordle cutover receipt does not match source or cutoff',
          );
        if (input.dryRun)
          return {
            status: 'already-prepared' as const,
            sourceDigest,
            cutoverDate: input.cutoverDate,
          };
        return {
          status: 'already-prepared' as const,
          sourceDigest,
          cutoverDate: input.cutoverDate,
        };
      }

      const [days, daily, sessions, drafts, streaks] = await Promise.all([
        tx.select().from(wordleDays),
        tx.select().from(wordleDaily),
        tx.select().from(wordleSessions),
        tx.select().from(wordleDrafts),
        tx.select().from(wordleStreaks),
      ]);
      const lateRows = [
        ...days
          .filter((row) => row.word_date >= input.cutoverDate)
          .map(() => 'legacy_day_on_or_after_cutover'),
        ...daily
          .filter((row) => row.word_date >= input.cutoverDate)
          .map(() => 'legacy_daily_on_or_after_cutover'),
        ...sessions
          .filter((row) => row.word_date >= input.cutoverDate)
          .map(() => 'legacy_session_on_or_after_cutover'),
      ];
      const issues = [...lateRows];
      if (drafts.length) issues.push('unexpected_legacy_drafts');
      if (
        input.sourceTag === 'fresh' &&
        (days.length || daily.length || sessions.length || streaks.length)
      )
        issues.push('fresh_source_is_not_empty');

      for (const session of sessions) {
        try {
          const guesses = z
            .array(guessRowSchema)
            .safeParse(JSON.parse(session.guesses));
          if (
            !guesses.success ||
            guesses.data.length !== session.attempts ||
            (session.solved_from_draft &&
              (!session.solved || session.attempts !== 0))
          )
            issues.push('invalid_legacy_session');
        } catch {
          issues.push('invalid_legacy_session');
        }
      }
      if (input.before.invalidDataIssues.invalidGuessPayload)
        issues.push('invalid_legacy_session');
      if (issues.length)
        throw new Error(
          `Global Wordle cutover blocked: ${[...new Set(issues)].sort().join(', ')}`,
        );

      const destinations = await Promise.all([
        tx.select().from(wordleGlobalDays).limit(1),
        tx.select().from(wordleGlobalSessions).limit(1),
        tx.select().from(wordleGlobalDrafts).limit(1),
        tx.select().from(wordleGlobalAchievements).limit(1),
        tx.select().from(wordleGlobalDiscoveries).limit(1),
        tx.select().from(wordleGlobalOccurrences).limit(1),
        tx.select().from(wordleGlobalSessionOrigins).limit(1),
        tx.select().from(wordleGlobalMigrationState).limit(1),
        tx.select().from(wordleCommunityParticipation).limit(1),
        tx.select().from(wordleCommunityDailyPresence).limit(1),
        tx.select().from(wordleCommunityWinAnnouncements).limit(1),
        tx.select().from(wordleLegacyProgress).limit(1),
      ]);
      if (destinations.some((rows) => rows.length))
        throw new Error(
          'Global Wordle destination is not empty; unsupported mixed destination',
        );

      const previousDate = cutoverPreviousDate(input.cutoverDate);
      const userIds = new Set([
        ...sessions.map((row) => row.user_id),
        ...streaks.map((row) => row.user_id),
      ]);
      for (const userId of userIds) {
        const userStreaks = streaks.filter((row) => row.user_id === userId);
        const active = userStreaks.filter(
          (row) =>
            row.current_streak > 0 && row.last_solved_date === previousDate,
        );
        const current = active.reduce(
          (max, row) => Math.max(max, row.current_streak),
          0,
        );
        const lastSolvedDate = current > 0 ? previousDate : null;
        const best = userStreaks.reduce(
          (max, row) => Math.max(max, row.max_streak, row.current_streak),
          0,
        );
        await tx.insert(wordleLegacyProgress).values({
          user_id: userId,
          current_streak: current,
          best_streak: best,
          last_solved_date: lastSolvedDate,
          cutover_date: input.cutoverDate,
        });
      }

      const presence = new Map<
        string,
        { guildId: string; userId: string; date: string; seenAt: number }
      >();
      for (const session of sessions) {
        const key = JSON.stringify([
          session.guild_id,
          session.user_id,
          session.word_date,
        ]);
        const old = presence.get(key);
        if (!old || session.created_at < old.seenAt)
          presence.set(key, {
            guildId: session.guild_id,
            userId: session.user_id,
            date: session.word_date,
            seenAt: session.created_at,
          });
        if (session.announced_at !== null) {
          await tx.insert(wordleCommunityWinAnnouncements).values({
            guild_id: session.guild_id,
            user_id: session.user_id,
            word_date: session.word_date,
            announced_at: session.announced_at,
          });
        }
      }
      for (const { guildId, userId, date, seenAt } of presence.values()) {
        await tx
          .insert(wordleCommunityParticipation)
          .values({
            guild_id: guildId,
            user_id: userId,
            first_seen_at: seenAt,
            last_seen_at: seenAt,
          });
        await tx
          .insert(wordleCommunityDailyPresence)
          .values({
            guild_id: guildId,
            user_id: userId,
            word_date: date,
            first_seen_at: seenAt,
          });
      }

      const verification = await verifyWordlePreservation(tx, input.before);
      if (!verification.ok)
        throw new Error(
          `Wordle source preservation verification failed: ${JSON.stringify(verification.mismatches)}`,
        );
      const now = Date.now();
      await tx.insert(wordleGlobalCutovers).values({
        id: 'global-only-v003',
        source_tag: input.sourceTag,
        cutover_date: input.cutoverDate,
        source_digest: sourceDigest,
        verified_at: now,
        completed_at: now,
      });
      if (input.dryRun) throw new DryRunRollback();
      return {
        status: 'prepared',
        sourceDigest,
        cutoverDate: input.cutoverDate,
      };
    });
  } catch (error) {
    if (error instanceof DryRunRollback)
      return {
        status: 'dry-run',
        sourceDigest,
        cutoverDate: input.cutoverDate,
      };
    throw error;
  }
}
