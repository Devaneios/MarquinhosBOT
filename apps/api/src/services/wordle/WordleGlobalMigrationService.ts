import {
  guessRowSchema,
  wordlePatternEvidenceSchema,
} from '@marquinhos/contracts/wordle';
import type { Db } from '@marquinhos/database/client';
import {
  achievements,
  userAchievements,
  wordleCommunityDailyPresence,
  wordleCommunityFirstSolves,
  wordleCommunityParticipation,
  wordleDays,
  wordleDrafts,
  wordleGlobalAchievements,
  wordleGlobalDays,
  wordleGlobalDiscoveries,
  wordleGlobalDrafts,
  wordleGlobalMigrationState,
  wordleGlobalOccurrences,
  wordleGlobalSessionOrigins,
  wordleGlobalSessions,
  wordlePatternDiscoveries,
  wordleSessions,
} from '@marquinhos/database/schema';
import { matchWordlePatterns } from '@marquinhos/domain/games/wordle/achievements/engine/matchPatterns';
import { eq, sql } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { prepareGlobalWordleReconciliation } from './globalReconciliation';

class DryRunRollback extends Error {}

/** Requires a frozen snapshot: legacy writers must be stopped before calling. */
export async function migrateGlobalWordle(
  database: Db,
  options: { dryRun?: boolean } = {},
): Promise<{ alreadyMigrated: boolean; dryRun: boolean }> {
  try {
    return await database.transaction(async (tx) => {
      await tx.execute(sql`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`);
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended('wordle-global-migration', 0))`,
      );
      const days = await tx.select().from(wordleDays);
      const sessions = await tx.select().from(wordleSessions);
      const drafts = await tx.select().from(wordleDrafts);
      const discoveries = await tx.select().from(wordlePatternDiscoveries);
      const earned = await tx
        .select({ award: userAchievements })
        .from(userAchievements)
        .innerJoin(
          achievements,
          eq(userAchievements.achievement_id, achievements.id),
        )
        .where(eq(achievements.category, 'wordle'));
      const canonicalRows = (rows: readonly unknown[]) =>
        rows.map((row) => JSON.stringify(row)).sort();
      const digest = createHash('sha256')
        .update(
          JSON.stringify(
            [days, sessions, drafts, discoveries, earned].map(canonicalRows),
          ),
        )
        .digest('hex');
      const [previous] = await tx
        .select()
        .from(wordleGlobalMigrationState)
        .where(eq(wordleGlobalMigrationState.id, 'legacy-wordle'));
      if (previous) {
        if (previous.source_digest !== digest)
          throw new Error('Global migration source changed');
        return { alreadyMigrated: true, dryRun: !!options.dryRun };
      }
      const targets = await Promise.all([
        tx.select().from(wordleGlobalDays).limit(1),
        tx.select().from(wordleGlobalSessions).limit(1),
        tx.select().from(wordleGlobalDrafts).limit(1),
        tx.select().from(wordleGlobalAchievements).limit(1),
        tx.select().from(wordleGlobalDiscoveries).limit(1),
        tx.select().from(wordleGlobalOccurrences).limit(1),
        tx.select().from(wordleGlobalSessionOrigins).limit(1),
        tx.select().from(wordleCommunityFirstSolves).limit(1),
      ]);
      if (targets.some((rows) => rows.length))
        throw new Error('Global migration target is not empty');

      const preview = prepareGlobalWordleReconciliation({
        days: days.map((row) => ({
          guildId: row.guild_id,
          date: row.word_date,
          answer: row.word,
        })),
        sessions: sessions.map((row) => ({
          id: row.id,
          userId: row.user_id,
          guildId: row.guild_id,
          date: row.word_date,
          guesses: row.guesses,
          solved: row.solved,
          attempts: row.attempts,
          createdAt: row.created_at,
        })),
      });
      const conflicts = [...preview.conflicts];
      const dayKeys = new Set(
        days.map((row) => JSON.stringify([row.guild_id, row.word_date])),
      );
      const byId = new Map(sessions.map((row) => [row.id, row]));
      for (const session of sessions) {
        let valid = false;
        try {
          const result = z
            .array(guessRowSchema)
            .safeParse(JSON.parse(session.guesses));
          valid = result.success && result.data.length === session.attempts;
        } catch {
          /* Corrupt history must not be guessed. */
        }
        if (
          !valid ||
          !dayKeys.has(JSON.stringify([session.guild_id, session.word_date]))
        )
          conflicts.push('invalid_session');
      }
      for (const group of preview.sessions) {
        const rows = group.sourceIds.map((id) => byId.get(id)!);
        if (
          new Set(
            rows.map((row) =>
              JSON.stringify([row.solved_from_draft, row.solved_at]),
            ),
          ).size > 1
        )
          conflicts.push('conflicting_session_state');
      }
      const draftGroups = new Map<string, typeof drafts>();
      for (const draft of drafts) {
        const key = JSON.stringify([draft.user_id, draft.word_date]);
        const group = draftGroups.get(key) ?? [];
        group.push(draft);
        draftGroups.set(key, group);
        if (!dayKeys.has(JSON.stringify([draft.guild_id, draft.word_date])))
          conflicts.push('orphan_draft');
      }
      for (const group of draftGroups.values()) {
        const fingerprints = group.map((row) =>
          JSON.stringify([
            row.row_index,
            row.cells,
            row.active_index,
            row.revision,
            row.updated_at,
            row.finalized_at,
            row.award_reconciled_at,
          ]),
        );
        if (new Set(fingerprints).size > 1)
          conflicts.push('conflicting_drafts');
      }
      if (conflicts.length)
        throw new Error(
          `Global migration conflicts: ${[...new Set(conflicts)].sort().join(', ')}`,
        );

      for (const day of preview.days) {
        const source = days
          .filter((row) => row.word_date === day.date && row.word !== null)
          .sort(
            (a, b) =>
              a.created_at - b.created_at ||
              a.guild_id.localeCompare(b.guild_id),
          )[0]!;
        await tx.insert(wordleGlobalDays).values({
          word_date: day.date,
          word: day.answer,
          word_length: source.word_length!,
          created_at: source.created_at,
        });
      }
      const recordPresence = async (
        guildId: string,
        userId: string,
        wordDate: string,
        seenAt: number,
      ) => {
        await tx
          .insert(wordleCommunityParticipation)
          .values({
            guild_id: guildId,
            user_id: userId,
            first_seen_at: seenAt,
            last_seen_at: seenAt,
          })
          .onConflictDoUpdate({
            target: [
              wordleCommunityParticipation.guild_id,
              wordleCommunityParticipation.user_id,
            ],
            set: {
              first_seen_at: sql`least(${wordleCommunityParticipation.first_seen_at}, ${seenAt})`,
              last_seen_at: sql`greatest(${wordleCommunityParticipation.last_seen_at}, ${seenAt})`,
            },
          });
        await tx
          .insert(wordleCommunityDailyPresence)
          .values({
            guild_id: guildId,
            user_id: userId,
            word_date: wordDate,
            first_seen_at: seenAt,
          })
          .onConflictDoUpdate({
            target: [
              wordleCommunityDailyPresence.guild_id,
              wordleCommunityDailyPresence.user_id,
              wordleCommunityDailyPresence.word_date,
            ],
            set: {
              first_seen_at: sql`least(${wordleCommunityDailyPresence.first_seen_at}, ${seenAt})`,
            },
          });
      };
      const globalIdBySource = new Map<string, string>();
      for (const group of preview.sessions) {
        const source = byId.get(group.canonicalId)!;
        await tx.insert(wordleGlobalSessions).values({
          id: source.id,
          user_id: source.user_id,
          word_date: source.word_date,
          guesses: source.guesses,
          solved: source.solved,
          solved_from_draft: source.solved_from_draft,
          solved_at: source.solved_at,
          attempts: source.attempts,
          created_at: source.created_at,
        });
        for (const id of group.sourceIds) {
          const origin = byId.get(id)!;
          globalIdBySource.set(id, source.id);
          await tx.insert(wordleGlobalSessionOrigins).values({
            source_session_id: id,
            global_session_id: source.id,
            guild_id: origin.guild_id,
            word_date: origin.word_date,
          });
          await recordPresence(
            origin.guild_id,
            origin.user_id,
            origin.word_date,
            origin.created_at,
          );
        }
      }
      for (const group of draftGroups.values()) {
        const source = group[0]!;
        for (const draft of group)
          await recordPresence(
            draft.guild_id,
            draft.user_id,
            draft.word_date,
            draft.updated_at,
          );
        await tx.insert(wordleGlobalDrafts).values({
          user_id: source.user_id,
          word_date: source.word_date,
          row_index: source.row_index,
          cells: source.cells,
          active_index: source.active_index,
          revision: source.revision,
          updated_at: source.updated_at,
          finalized_at: source.finalized_at,
          award_reconciled_at: source.award_reconciled_at,
        });
      }
      for (const { award } of [...earned].sort(
        (a, b) => a.award.unlocked_at - b.award.unlocked_at,
      )) {
        await tx
          .insert(wordleGlobalAchievements)
          .values({
            user_id: award.user_id,
            achievement_id: award.achievement_id,
            unlocked_at: award.unlocked_at,
          })
          .onConflictDoNothing();
      }
      for (const discovery of [...discoveries].sort(
        (a, b) =>
          a.discovered_at - b.discovered_at ||
          a.session_id.localeCompare(b.session_id) ||
          a.guild_id.localeCompare(b.guild_id),
      )) {
        const evidence = wordlePatternEvidenceSchema.safeParse(
          discovery.evidence,
        );
        const sessionId = globalIdBySource.get(discovery.session_id);
        if (
          !evidence.success ||
          evidence.data.patternId !== discovery.pattern_id ||
          !sessionId
        )
          continue;
        const source = byId.get(discovery.session_id);
        if (
          !source ||
          source.user_id !== discovery.user_id ||
          source.guild_id !== discovery.guild_id ||
          source.word_date !== evidence.data.date
        )
          continue;
        const guesses = z
          .array(guessRowSchema)
          .safeParse(JSON.parse(source.guesses));
        if (
          !guesses.success ||
          JSON.stringify(
            guesses.data
              .slice(0, evidence.data.feedback.length)
              .map((guess) => guess.feedback),
          ) !== JSON.stringify(evidence.data.feedback)
        )
          continue;
        const match = matchWordlePatterns(evidence.data.feedback).find(
          (candidate) => candidate.patternId === discovery.pattern_id,
        );
        if (
          !match ||
          match.color !== evidence.data.color ||
          match.rotation !== evidence.data.rotation ||
          JSON.stringify(match.origin) !==
            JSON.stringify(evidence.data.origin) ||
          JSON.stringify(match.cells) !== JSON.stringify(evidence.data.cells)
        )
          continue;
        await tx
          .insert(wordleGlobalDiscoveries)
          .values({
            user_id: discovery.user_id,
            pattern_id: discovery.pattern_id,
            session_id: sessionId,
            discovered_at: discovery.discovered_at,
            evidence: evidence.data,
          })
          .onConflictDoNothing();
      }
      const firstByGuildDay = new Map<string, (typeof sessions)[number]>();
      const sorted = [...sessions]
        .filter(
          (row) =>
            row.solved &&
            row.solved_at !== null &&
            row.first_solver !== false &&
            (row.attempts > 0 || row.solved_from_draft),
        )
        .sort(
          (a, b) =>
            Number(b.first_solver === true) - Number(a.first_solver === true) ||
            a.solved_at! - b.solved_at! ||
            a.id.localeCompare(b.id),
        );
      for (const session of sorted) {
        const key = JSON.stringify([session.guild_id, session.word_date]);
        if (!firstByGuildDay.has(key)) firstByGuildDay.set(key, session);
      }
      for (const session of firstByGuildDay.values()) {
        await tx.insert(wordleCommunityFirstSolves).values({
          guild_id: session.guild_id,
          word_date: session.word_date,
          user_id: session.user_id,
          session_id: globalIdBySource.get(session.id)!,
          solved_at: session.solved_at!,
        });
      }
      await tx.insert(wordleGlobalMigrationState).values({
        id: 'legacy-wordle',
        source_digest: digest,
        completed_at: Date.now(),
      });
      if (options.dryRun) throw new DryRunRollback();
      return { alreadyMigrated: false, dryRun: false };
    });
  } catch (error) {
    if (error instanceof DryRunRollback)
      return { alreadyMigrated: false, dryRun: true };
    throw error;
  }
}
