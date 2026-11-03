import {
  guessRowSchema,
  wordleAchievementsOverviewSchema,
  wordlePatternEvidenceSchema,
  type WordleAchievementsOverview,
} from '@marquinhos/contracts/wordle';
import type { Db, DbExecutor } from '@marquinhos/database/client';
import {
  achievements,
  wordleCommunityFirstSolves,
  wordleCommunityParticipation,
  wordleGlobalAcceptedGuesses,
  wordleGlobalAchievements,
  wordleGlobalDays,
  wordleGlobalDiscoveries,
  wordleGlobalOccurrences,
  wordleGlobalSessions,
  wordleStreaks,
} from '@marquinhos/database/schema';
import { WORDLE_ACHIEVEMENT_CATALOG } from '@marquinhos/domain/games/wordle/achievements/catalog';
import { analyzeWordleAchievements } from '@marquinhos/domain/games/wordle/achievements/engine/evaluate';
import type { AchievementHistoryDay } from '@marquinhos/domain/games/wordle/achievements/engine/history';
import { computeWordlePlayerStats } from '@marquinhos/domain/games/wordle/playerStats';
import { stripDiacritics } from '@marquinhos/domain/shared/text/stripDiacritics';
import { and, asc, countDistinct, eq, inArray, isNull, sql } from 'drizzle-orm';
import { logger } from 'utils/logger';
import { z } from 'zod';
import { LevelingService } from '../gamification/LevelingService';
import { WordleAlbumService } from './WordleAlbumService';
import { getWordleTimeZone } from './wordleDate';
import { visibleWordleEvidence } from './wordleEvidenceVisibility';

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

  private async loadHistory(userId: string, exec: DbExecutor) {
    const rows = await exec
      .select({ session: wordleGlobalSessions, day: wordleGlobalDays })
      .from(wordleGlobalSessions)
      .innerJoin(
        wordleGlobalDays,
        eq(wordleGlobalSessions.word_date, wordleGlobalDays.word_date),
      )
      .where(eq(wordleGlobalSessions.user_id, userId))
      .orderBy(asc(wordleGlobalSessions.word_date));
    const firstSolves = await exec
      .select({ date: wordleCommunityFirstSolves.word_date })
      .from(wordleCommunityFirstSolves)
      .where(eq(wordleCommunityFirstSolves.user_id, userId));
    const firstDates = new Set(firstSolves.map((row) => row.date));
    const [legacy] = await exec
      .select({ best: sql<number | null>`max(${wordleStreaks.max_streak})` })
      .from(wordleStreaks)
      .where(eq(wordleStreaks.user_id, userId));
    const now = this.now();
    const options = {
      today: new Intl.DateTimeFormat('sv-SE', {
        timeZone: getWordleTimeZone(),
      }).format(new Date(now)),
      timeZone: getWordleTimeZone(),
      persistedBestStreak: legacy?.best ?? 0,
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
        answerHasRepeatedLetters: new Set(normalized).size < normalized.length,
        answerHasAccent: day.word !== normalized,
        startedAt: session.created_at,
        solvedAt: session.solved ? session.solved_at : null,
        firstSolverInGuild: firstDates.has(session.word_date),
      };
    });

    return { rows, history, options, now };
  }

  async getOverview(
    userId: string,
    guildId: string,
    viewerId: string,
  ): Promise<WordleAchievementsOverview> {
    return this.database.transaction(async (tx) => {
      const { history, options } = await this.loadHistory(userId, tx);
      const discoveries = await tx
        .select()
        .from(wordleGlobalDiscoveries)
        .where(eq(wordleGlobalDiscoveries.user_id, userId));
      const evidence = new Map(
        discoveries.flatMap((row) => {
          const parsed = wordlePatternEvidenceSchema.safeParse(row.evidence);
          return parsed.success && parsed.data.patternId === row.pattern_id
            ? [[row.pattern_id, parsed.data] as const]
            : [];
        }),
      );
      const unlockedRows = await tx
        .select()
        .from(wordleGlobalAchievements)
        .where(eq(wordleGlobalAchievements.user_id, userId));
      const unlocks = new Map(
        unlockedRows.map((row) => [row.achievement_id, row.unlocked_at]),
      );
      const evaluated = analyzeWordleAchievements(history, options).evaluate(
        new Set(evidence.keys()),
      );
      const progress = new Map(evaluated.map((row) => [row.id, row.progress]));
      const [total] = await tx
        .select({ count: countDistinct(wordleCommunityParticipation.user_id) })
        .from(wordleCommunityParticipation)
        .where(eq(wordleCommunityParticipation.guild_id, guildId));
      const holders = await tx
        .select({
          id: wordleGlobalAchievements.achievement_id,
          count: countDistinct(wordleGlobalAchievements.user_id),
        })
        .from(wordleGlobalAchievements)
        .innerJoin(
          wordleCommunityParticipation,
          eq(
            wordleCommunityParticipation.user_id,
            wordleGlobalAchievements.user_id,
          ),
        )
        .where(eq(wordleCommunityParticipation.guild_id, guildId))
        .groupBy(wordleGlobalAchievements.achievement_id);
      const percentages = new Map(holders.map((row) => [row.id, row.count]));
      const collection = WORDLE_ACHIEVEMENT_CATALOG.map((definition) => {
        const at = unlocks.get(definition.id);
        const concealed = definition.hidden && at === undefined;
        const drawing =
          definition.kind === 'drawing' ? definition.drawing : undefined;
        const witness = drawing ? evidence.get(drawing.patternId) : undefined;
        const visibleWitness = visibleWordleEvidence(
          witness,
          userId,
          viewerId,
          options.today,
        );
        return {
          id: definition.id,
          family: definition.family,
          tier: definition.tier,
          hidden: definition.hidden,
          name: concealed ? '' : definition.name,
          description: concealed ? '' : definition.description,
          icon: concealed ? '❔' : definition.icon,
          rarity: definition.rarity,
          rewardXp: definition.rewardXp,
          unlockedAt: at === undefined ? null : new Date(at).toISOString(),
          progress: concealed ? null : (progress.get(definition.id) ?? null),
          holdersPercent: total?.count
            ? Math.round(
                ((percentages.get(definition.id) ?? 0) / total.count) * 10000,
              ) / 100
            : null,
          ...(drawing && !concealed
            ? {
                patternPreview: {
                  patternId: drawing.patternId,
                  mask: drawing.mask,
                  variants: drawing.variants,
                  colors: drawing.colors,
                  rotations: drawing.rotations,
                },
                matchEvidence: at === undefined ? null : visibleWitness,
              }
            : {}),
        };
      });
      return wordleAchievementsOverviewSchema.parse({
        achievements: collection,
        stats: computeWordlePlayerStats(history, options),
      });
    });
  }

  async getStats(userId: string) {
    const { history, options } = await this.loadHistory(userId, this.database);
    return computeWordlePlayerStats(history, options);
  }

  async checkAndAward(
    userId: string,
    guildId: string,
  ): Promise<{ unlockedIds: string[] }> {
    const outcome = await this.database.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify(['wordle-global-achievements', userId])}, 0))`,
      );
      const { rows, history, options, now } = await this.loadHistory(
        userId,
        tx,
      );
      const stored = await tx
        .select()
        .from(wordleGlobalDiscoveries)
        .where(eq(wordleGlobalDiscoveries.user_id, userId));
      const known = new Set(stored.map((row) => row.pattern_id));
      const analysis = analyzeWordleAchievements(history, options);
      const sessionByDate = new Map(
        rows.map(({ session }) => [session.word_date, session.id]),
      );
      const accepted = await tx
        .select({
          sessionId: wordleGlobalAcceptedGuesses.session_id,
          attempt: wordleGlobalAcceptedGuesses.attempt,
          acceptedAt: wordleGlobalAcceptedGuesses.accepted_at,
        })
        .from(wordleGlobalAcceptedGuesses)
        .where(eq(wordleGlobalAcceptedGuesses.user_id, userId));
      const acceptedTimes = new Map(
        accepted.map((event) => [
          JSON.stringify([event.sessionId, event.attempt]),
          event.acceptedAt,
        ]),
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
          const row = Math.max(...evidence.cells.map(([index]) => index)) + 1;
          const sourceAt =
            acceptedTimes.get(JSON.stringify([source, row])) ?? null;
          await tx
            .insert(wordleGlobalOccurrences)
            .values({
              user_id: userId,
              word_date: day.date,
              pattern_id: match.patternId,
              session_id: source,
              occurred_at: now,
              source_at: sourceAt,
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
    try {
      await new WordleAlbumService(this.database).reconcileUser(userId);
    } catch (error) {
      logger.warn('wordle.album.achievement_projection_failed', {
        error,
        userId,
      });
    }
    return outcome;
  }
}
