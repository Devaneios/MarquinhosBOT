import {
  guessRowSchema,
  wordlePatternEvidenceSchema,
} from '@marquinhos/contracts/wordle';
import type { Db } from '@marquinhos/database/client';
import {
  achievements,
  wordleCommunityFirstSolves,
  wordleGlobalAchievements,
  wordleGlobalDays,
  wordleGlobalDiscoveries,
  wordleGlobalOccurrences,
  wordleGlobalSessions,
} from '@marquinhos/database/schema';
import { analyzeWordleAchievements } from '@marquinhos/domain/games/wordle/achievements/engine/evaluate';
import type { AchievementHistoryDay } from '@marquinhos/domain/games/wordle/achievements/engine/history';
import { stripDiacritics } from '@marquinhos/domain/shared/text/stripDiacritics';
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { LevelingService } from '../gamification/LevelingService';
import { getWordleTimeZone } from './wordleDate';

function parseGuesses(raw: string) {
  try {
    const result = z.array(guessRowSchema).safeParse(JSON.parse(raw));
    return result.success ? result.data : [];
  } catch {
    return [];
  }
}

export class WordleGlobalAchievementService {
  constructor(
    private readonly database: Db,
    private readonly now: () => number = Date.now,
  ) {}

  async checkAndAward(
    userId: string,
    guildId: string,
  ): Promise<{ unlockedIds: string[] }> {
    return this.database.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify(['wordle-global-achievements', userId])}, 0))`,
      );
      const rows = await tx
        .select({ session: wordleGlobalSessions, day: wordleGlobalDays })
        .from(wordleGlobalSessions)
        .innerJoin(
          wordleGlobalDays,
          eq(wordleGlobalSessions.word_date, wordleGlobalDays.word_date),
        )
        .where(eq(wordleGlobalSessions.user_id, userId))
        .orderBy(asc(wordleGlobalSessions.word_date));
      const firstSolves = await tx
        .select({ date: wordleCommunityFirstSolves.word_date })
        .from(wordleCommunityFirstSolves)
        .where(eq(wordleCommunityFirstSolves.user_id, userId));
      const firstDates = new Set(firstSolves.map((row) => row.date));
      const now = this.now();
      const options = {
        today: new Intl.DateTimeFormat('sv-SE', {
          timeZone: getWordleTimeZone(),
        }).format(new Date(now)),
        timeZone: getWordleTimeZone(),
      };
      const history: AchievementHistoryDay[] = rows.map(({ session, day }) => {
        const normalized = stripDiacritics(day.word);
        return {
          date: session.word_date,
          solved: session.solved,
          solvedFromDraft: session.solved_from_draft,
          attempts: session.attempts,
          guesses: parseGuesses(session.guesses),
          wordLength: day.word_length,
          answerHasRepeatedLetters:
            new Set(normalized).size < normalized.length,
          answerHasAccent: day.word !== normalized,
          startedAt: session.created_at,
          solvedAt: session.solved ? session.solved_at : null,
          firstSolverInGuild: firstDates.has(session.word_date),
        };
      });
      const stored = await tx
        .select()
        .from(wordleGlobalDiscoveries)
        .where(eq(wordleGlobalDiscoveries.user_id, userId));
      const known = new Set(stored.map((row) => row.pattern_id));
      const analysis = analyzeWordleAchievements(history, options);
      const sessionByDate = new Map(
        rows.map(({ session }) => [session.word_date, session.id]),
      );
      for (const day of history) {
        const source = sessionByDate.get(day.date);
        if (!source) continue;
        const matches = analyzeWordleAchievements(
          [day],
          options,
        ).discoverPatterns(new Set());
        for (const match of matches) {
          const evidence = wordlePatternEvidenceSchema.parse(match);
          await tx
            .insert(wordleGlobalOccurrences)
            .values({
              user_id: userId,
              word_date: day.date,
              pattern_id: match.patternId,
              session_id: source,
              occurred_at: now,
              evidence,
            })
            .onConflictDoNothing();
        }
      }
      for (const match of analysis.discoverPatterns(known)) {
        const source = sessionByDate.get(match.date);
        if (!source) throw new Error('Discovery has no global session');
        await tx
          .insert(wordleGlobalDiscoveries)
          .values({
            user_id: userId,
            pattern_id: match.patternId,
            session_id: source,
            discovered_at: now,
            evidence: wordlePatternEvidenceSchema.parse(match),
          })
          .onConflictDoNothing();
        known.add(match.patternId);
      }
      const eligibleIds = analysis
        .evaluate(known)
        .filter((item) => item.met)
        .map((item) => item.id);
      if (eligibleIds.length === 0) return { unlockedIds: [] };
      const definitions = await tx
        .select({ id: achievements.id, reward: achievements.reward_xp })
        .from(achievements)
        .where(
          and(
            inArray(achievements.id, eligibleIds),
            eq(achievements.category, 'wordle'),
            isNull(achievements.archived_at),
          ),
        );
      if (definitions.length === 0) return { unlockedIds: [] };
      const inserted = await tx
        .insert(wordleGlobalAchievements)
        .values(
          definitions.map((definition) => ({
            user_id: userId,
            achievement_id: definition.id,
            unlocked_at: now,
          })),
        )
        .onConflictDoNothing()
        .returning({ id: wordleGlobalAchievements.achievement_id });
      const unlockedIds = inserted.map((row) => row.id);
      const newlyUnlocked = new Set(unlockedIds);
      const xp = definitions
        .filter((item) => newlyUnlocked.has(item.id))
        .reduce((total, item) => total + Math.max(0, item.reward), 0);
      if (xp > 0) {
        const leveling = new LevelingService();
        await leveling.ensureUser(userId, guildId, tx);
        await leveling.addXpToUser(userId, guildId, xp, tx, null);
        await leveling.applyLevelUps(userId, guildId, tx);
      }
      return { unlockedIds };
    });
  }
}
