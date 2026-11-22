import {
  guessRowSchema,
  wordleAchievementsOverviewSchema,
  wordlePatternEvidenceSchema,
  type WordleAchievementsOverview,
} from '@marquinhos/contracts/wordle';
import type { Db, DbExecutor } from '@marquinhos/database/client';
import {
  achievements,
  wordleCommunityDailyPresence,
  wordleCommunityFirstSolves,
  wordleCommunityParticipation,
  wordleGlobalAcceptedGuesses,
  wordleGlobalAchievements,
  wordleGlobalDays,
  wordleGlobalDiscoveries,
  wordleGlobalOccurrences,
  wordleGlobalSessions,
} from '@marquinhos/database/schema';
import { WORDLE_ACHIEVEMENT_CATALOG } from '@marquinhos/domain/games/wordle/achievements/catalog';
import { analyzeWordleAchievements } from '@marquinhos/domain/games/wordle/achievements/engine/evaluate';
import type { AchievementHistoryDay } from '@marquinhos/domain/games/wordle/achievements/engine/history';
import { achievementXpForRarity } from '@marquinhos/domain/games/wordle/achievements/rewards';
import { stripDiacritics } from '@marquinhos/domain/shared/text/stripDiacritics';
import { Inject, Injectable } from '@nestjs/common';
import { logger } from 'common/logging/logger';
import { DB } from 'database/database.tokens';
import {
  and,
  asc,
  countDistinct,
  eq,
  gte,
  inArray,
  isNull,
  sql,
} from 'drizzle-orm';
import { LevelingService } from 'modules/gamification/leveling.service';
import { enqueueAlbumProjections } from 'modules/wordle/community/wordle-album-projection-queue';
import { WordleAlbumService } from 'modules/wordle/community/wordle-album.service';
import { getWordleTimeZone } from 'modules/wordle/wordle-date';
import { WORDLE_NOW } from 'modules/wordle/wordle.tokens';
import { z } from 'zod';
import { lockWordleAchievements } from './wordle-achievement-lock';
import { visibleWordleEvidence } from './wordle-evidence-visibility';
import { WordleHistoryService } from './wordle-history.service';

function parseGuesses(raw: string) {
  try {
    const result = z.array(guessRowSchema).safeParse(JSON.parse(raw));
    return result.success ? result.data : [];
  } catch {
    return [];
  }
}

@Injectable()
export class WordleGlobalAchievementService {
  constructor(
    @Inject(DB) private readonly database: Db,
    private readonly leveling: LevelingService,
    private readonly album: WordleAlbumService,
    private readonly historyService: WordleHistoryService,
    @Inject(WORDLE_NOW)
    private readonly now: () => number = Date.now,
  ) {}

  private async loadHistory(userId: string, exec: DbExecutor) {
    const legacyHistory = await this.historyService.getLegacyAchievementHistory(
      userId,
      parseGuesses,
      exec,
    );
    const rows = await exec
      .select({ session: wordleGlobalSessions, day: wordleGlobalDays })
      .from(wordleGlobalSessions)
      .innerJoin(
        wordleGlobalDays,
        eq(wordleGlobalSessions.word_date, wordleGlobalDays.word_date),
      )
      .where(
        legacyHistory.cutoverDate
          ? and(
              eq(wordleGlobalSessions.user_id, userId),
              gte(wordleGlobalSessions.word_date, legacyHistory.cutoverDate),
            )
          : eq(wordleGlobalSessions.user_id, userId),
      )
      .orderBy(asc(wordleGlobalSessions.word_date));
    const firstSolves = await exec
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
    const aggregateStats = await this.historyService.getStats(
      userId,
      options.today,
      exec,
    );
    const legacyUnlocks = await this.historyService.getLegacyUnlocks(
      userId,
      exec,
    );
    const history: AchievementHistoryDay[] = [
      ...legacyHistory.days,
      ...rows.map(({ session, day }) => {
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
      }),
    ];

    return {
      rows,
      history,
      options: { ...options, aggregateStats },
      legacyUnlocks,
      now,
    };
  }

  async getOverview(
    userId: string,
    guildId: string,
    viewerId: string,
  ): Promise<WordleAchievementsOverview> {
    return this.database.transaction(async (tx) => {
      const loaded = await this.loadHistory(userId, tx);
      const { history, options } = loaded;
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
      const legacyUnlocks = loaded.legacyUnlocks;
      const unlockedRows = await tx
        .select()
        .from(wordleGlobalAchievements)
        .where(eq(wordleGlobalAchievements.user_id, userId));
      const unlocks = new Map<string, number>(
        unlockedRows.map((row) => [row.achievement_id, row.unlocked_at]),
      );
      for (const legacy of legacyUnlocks) {
        const current = unlocks.get(legacy.id);
        if (current === undefined || legacy.unlockedAt < current)
          unlocks.set(legacy.id, legacy.unlockedAt);
      }
      const evaluated = analyzeWordleAchievements(history, options).evaluate(
        new Set(evidence.keys()),
      );
      const progress = new Map(evaluated.map((row) => [row.id, row.progress]));
      const [total] = await tx
        .select({ count: countDistinct(wordleCommunityParticipation.user_id) })
        .from(wordleCommunityParticipation)
        .where(eq(wordleCommunityParticipation.guild_id, guildId));
      const holders = await tx.execute<{ id: string; count: number }>(sql`
        WITH earned AS (
          SELECT user_id, achievement_id FROM wordle_global_achievements
          UNION
          SELECT user_id, achievement_id FROM user_achievements
        )
        SELECT earned.achievement_id AS id, count(DISTINCT earned.user_id)::int AS count
        FROM earned
        INNER JOIN wordle_community_participation participation
          ON participation.user_id = earned.user_id
        WHERE participation.guild_id = ${guildId}
        GROUP BY earned.achievement_id
      `);
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
          hidden: definition.hidden,
          name: concealed ? '' : definition.name,
          description: concealed ? '' : definition.description,
          icon: concealed ? '❔' : definition.icon,
          rarity: definition.rarity,
          rewardXp: achievementXpForRarity(definition.rarity),
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
      const currentIds = new Set<string>(
        WORDLE_ACHIEVEMENT_CATALOG.map((definition) => definition.id),
      );
      const retired = legacyUnlocks
        .filter((unlock) => !currentIds.has(unlock.id))
        .map((unlock) => ({
          id: unlock.id,
          family: 'wordle' as const,
          hidden: false,
          name: unlock.name,
          description: unlock.description,
          icon: unlock.icon,
          rarity: unlock.rarity,
          rewardXp: unlock.rewardXp,
          unlockedAt: new Date(unlock.unlockedAt).toISOString(),
          progress: null,
          holdersPercent: total?.count
            ? Math.round(
                ((percentages.get(unlock.id) ?? 0) / total.count) * 10000,
              ) / 100
            : null,
        }));
      return wordleAchievementsOverviewSchema.parse({
        achievements: [...collection, ...retired],
        stats: options.aggregateStats,
      });
    });
  }

  async getStats(userId: string) {
    const today = new Intl.DateTimeFormat('sv-SE', {
      timeZone: getWordleTimeZone(),
    }).format(new Date(this.now()));
    return this.historyService.getStats(userId, today, this.database);
  }

  async checkAndAward(
    userId: string,
    guildId: string,
  ): Promise<{ unlockedIds: string[] }> {
    const outcome = await this.database.transaction(async (tx) => {
      await lockWordleAchievements(tx, userId);
      const { rows, history, options, legacyUnlocks, now } =
        await this.loadHistory(userId, tx);
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
      const recorded = new Set(
        (
          await tx
            .select({
              date: wordleGlobalOccurrences.word_date,
              patternId: wordleGlobalOccurrences.pattern_id,
            })
            .from(wordleGlobalOccurrences)
            .where(eq(wordleGlobalOccurrences.user_id, userId))
        ).map((row) => JSON.stringify([row.date, row.patternId])),
      );
      // Patterns are matched per board, so analysing each day on its own in
      // memory is cheap; only occurrences not stored yet are written.
      const occurrences: (typeof wordleGlobalOccurrences.$inferInsert)[] = [];
      for (const day of history) {
        const source = sessionByDate.get(day.date);
        if (!source) continue;
        const matches = analyzeWordleAchievements(
          [day],
          options,
        ).discoverPatterns(new Set());
        for (const match of matches) {
          if (recorded.has(JSON.stringify([day.date, match.patternId])))
            continue;
          const evidence = wordlePatternEvidenceSchema.parse(match);
          const row = Math.max(...evidence.cells.map(([index]) => index)) + 1;
          occurrences.push({
            user_id: userId,
            word_date: day.date,
            pattern_id: match.patternId,
            session_id: source,
            occurred_at: now,
            source_at: acceptedTimes.get(JSON.stringify([source, row])) ?? null,
            evidence,
          });
        }
      }
      const newDates = new Set<string>();
      for (let at = 0; at < occurrences.length; at += 500) {
        const inserted = await tx
          .insert(wordleGlobalOccurrences)
          .values(occurrences.slice(at, at + 500))
          .onConflictDoNothing()
          .returning({ date: wordleGlobalOccurrences.word_date });
        for (const { date } of inserted) newDates.add(date);
      }
      if (newDates.size > 0) {
        const guilds = await tx
          .selectDistinct({ guildId: wordleCommunityDailyPresence.guild_id })
          .from(wordleCommunityDailyPresence)
          .where(
            and(
              eq(wordleCommunityDailyPresence.user_id, userId),
              inArray(wordleCommunityDailyPresence.word_date, [...newDates]),
            ),
          );
        await enqueueAlbumProjections(
          tx,
          guilds.map((row) => row.guildId),
        );
      }
      // Discovery records reference global sessions. Legacy boards still feed
      // lifetime rules, but cannot be stored as global discovery evidence.
      const globalAnalysis = analyzeWordleAchievements(
        history.filter((day) => sessionByDate.has(day.date)),
        options,
      );
      for (const match of globalAnalysis.discoverPatterns(known)) {
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
      const alreadyUnlocked = new Set(legacyUnlocks.map((unlock) => unlock.id));
      const eligibleIds = analysis
        .evaluate(known)
        .filter((item) => item.met && !alreadyUnlocked.has(item.id))
        .map((item) => item.id);
      if (eligibleIds.length === 0) return { unlockedIds: [], newDates };
      const definitions = await tx
        .select({ id: achievements.id })
        .from(achievements)
        .where(
          and(
            inArray(achievements.id, eligibleIds),
            eq(achievements.category, 'wordle'),
            isNull(achievements.archived_at),
          ),
        );
      if (definitions.length === 0) return { unlockedIds: [], newDates };
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
      const xp = WORDLE_ACHIEVEMENT_CATALOG.filter((item) =>
        newlyUnlocked.has(item.id),
      ).reduce((total, item) => total + achievementXpForRarity(item.rarity), 0);
      if (xp > 0) {
        await this.leveling.ensureUser(userId, guildId, tx);
        await this.leveling.addXpToUser(userId, guildId, xp, tx, null);
        await this.leveling.applyLevelUps(userId, guildId, tx);
      }
      return { unlockedIds, newDates };
    });
    try {
      await this.album.reconcileUser(userId, outcome.newDates);
    } catch (error) {
      logger.warn('wordle.album.achievement_projection_failed', {
        error,
        userId,
      });
    }
    return { unlockedIds: outcome.unlockedIds };
  }
}
