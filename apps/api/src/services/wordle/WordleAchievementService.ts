import {
  guessRowSchema,
  wordleAchievementsOverviewSchema,
  wordlePatternEvidenceSchema,
  wordleUnlockedAchievementSchema,
  type WordleAchievementProgressUpdate,
  type WordleAchievementsOverview,
  type WordleAchievementStatus,
  type WordlePatternEvidence,
  type WordleUnlockedAchievement,
} from '@marquinhos/contracts/wordle';
import { db, type DbExecutor } from '@marquinhos/database/client';
import {
  achievements,
  userAchievements,
  wordleDays,
  wordlePatternDiscoveries,
  wordleSessions,
  wordleStreaks,
} from '@marquinhos/database/schema';
import {
  WORDLE_ACHIEVEMENT_CATALOG,
  WORDLE_ACHIEVEMENT_VERSION,
} from '@marquinhos/domain/games/wordle/achievements/catalog';
import { discoverWordlePatterns } from '@marquinhos/domain/games/wordle/achievements/engine/discoverPatterns';
import { evaluateWordleAchievements } from '@marquinhos/domain/games/wordle/achievements/engine/evaluate';
import type { AchievementHistoryDay } from '@marquinhos/domain/games/wordle/achievements/engine/history';
import { getWordlePatternPreview } from '@marquinhos/domain/games/wordle/achievements/patterns';
import { computeWordlePlayerStats } from '@marquinhos/domain/games/wordle/playerStats';
import { stripDiacritics } from '@marquinhos/domain/shared/text/stripDiacritics';
import {
  and,
  asc,
  countDistinct,
  desc,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
} from 'drizzle-orm';
import { AchievementService } from 'services/gamification/AchievementService';
import { LevelingService } from 'services/gamification/LevelingService';
import { getActiveWordleAchievementVersion } from 'services/wordle/WordleAchievementVersionService';
import { getRecifeDate, getWordleTimeZone } from 'services/wordle/wordleDate';
import { z } from 'zod';

const backfillOptionsSchema = z.object({
  guildId: z.string().min(1).optional(),
  batchSize: z.number().int().min(1).max(1000).default(100),
});

function readGuesses(serialized: string) {
  try {
    const parsed = z.array(guessRowSchema).safeParse(JSON.parse(serialized));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

type HistoryDay = AchievementHistoryDay & {
  sessionId: string;
  achievementVersion: number;
};
type AwardResult = {
  unlockedAchievements: WordleUnlockedAchievement[];
  stats: WordleAchievementsOverview['stats'];
  achievementProgress: WordleAchievementProgressUpdate[];
  achievementVersion: number;
  achievements: WordleAchievementStatus[];
};

export class WordleAchievementService {
  private readonly awards = new AchievementService(new LevelingService());

  async loadHistory(userId: string, guildId: string, exec: DbExecutor = db) {
    const history = await exec
      .select({
        session: wordleSessions,
        word: wordleDays.word,
        width: wordleDays.word_length,
      })
      .from(wordleSessions)
      .leftJoin(
        wordleDays,
        and(
          eq(wordleDays.guild_id, wordleSessions.guild_id),
          eq(wordleDays.word_date, wordleSessions.word_date),
        ),
      )
      .where(
        and(
          eq(wordleSessions.user_id, userId),
          eq(wordleSessions.guild_id, guildId),
          gt(wordleSessions.attempts, 0),
        ),
      )
      .orderBy(asc(wordleSessions.word_date));
    const solvedDates = history
      .filter(({ session }) => session.solved && session.solved_at !== null)
      .map(({ session }) => session.word_date);
    const firstSolvers =
      solvedDates.length === 0
        ? []
        : await exec
            .selectDistinctOn([wordleSessions.word_date], {
              date: wordleSessions.word_date,
              id: wordleSessions.id,
            })
            .from(wordleSessions)
            .where(
              and(
                eq(wordleSessions.guild_id, guildId),
                inArray(wordleSessions.word_date, solvedDates),
                eq(wordleSessions.solved, true),
                isNotNull(wordleSessions.solved_at),
                gt(wordleSessions.attempts, 0),
                or(
                  eq(wordleSessions.first_solver, true),
                  isNull(wordleSessions.first_solver),
                ),
              ),
            )
            .orderBy(
              asc(wordleSessions.word_date),
              desc(sql`coalesce(${wordleSessions.first_solver}, false)`),
              asc(wordleSessions.solved_at),
              asc(wordleSessions.id),
            );
    const firstIds = new Set(firstSolvers.map((row) => row.id));
    const [saved] = await exec
      .select()
      .from(wordleStreaks)
      .where(
        and(
          eq(wordleStreaks.user_id, userId),
          eq(wordleStreaks.guild_id, guildId),
        ),
      );
    const days: HistoryDay[] = history.map(({ session: row, word, width }) => {
      const normalized = word === null ? null : stripDiacritics(word);
      return {
        sessionId: row.id,
        achievementVersion: row.achievement_version,
        date: row.word_date,
        solved: row.solved,
        attempts: row.attempts,
        guesses: readGuesses(row.guesses),
        wordLength: width,
        answerHasRepeatedLetters:
          normalized === null
            ? null
            : new Set(normalized).size < normalized.length,
        answerHasAccent: word === null ? null : word !== normalized,
        startedAt: row.created_at,
        solvedAt: row.solved ? row.solved_at : null,
        firstSolverInGuild: row.solved && firstIds.has(row.id),
      };
    });
    return {
      days,
      options: {
        today: getRecifeDate(),
        timeZone: getWordleTimeZone(),
        persistedBestStreak: Math.max(
          saved?.current_streak ?? 0,
          saved?.max_streak ?? 0,
        ),
      },
    };
  }

  private loadUnlocks(
    userId: string,
    guildId: string,
    version: number,
    exec: DbExecutor,
  ) {
    return exec
      .select({
        id: userAchievements.achievement_id,
        at: userAchievements.unlocked_at,
      })
      .from(userAchievements)
      .innerJoin(
        achievements,
        eq(achievements.id, userAchievements.achievement_id),
      )
      .where(
        and(
          eq(userAchievements.user_id, userId),
          eq(userAchievements.guild_id, guildId),
          isNull(achievements.archived_at),
          eq(achievements.category, 'wordle'),
          eq(achievements.wordle_version, version),
        ),
      );
  }

  private async loadDiscoveries(
    userId: string,
    guildId: string,
    version: number,
    exec: DbExecutor,
  ) {
    const rows = await exec
      .select()
      .from(wordlePatternDiscoveries)
      .where(
        and(
          eq(wordlePatternDiscoveries.user_id, userId),
          eq(wordlePatternDiscoveries.guild_id, guildId),
          eq(wordlePatternDiscoveries.version, version),
        ),
      );
    const evidence = new Map<string, WordlePatternEvidence>();
    for (const row of rows) {
      const parsed = wordlePatternEvidenceSchema.safeParse(row.evidence);
      if (parsed.success) evidence.set(row.pattern_id, parsed.data);
    }
    return evidence;
  }

  private async holderPercentages(
    guildId: string,
    version: number,
    exec: DbExecutor,
  ) {
    const [total] = await exec
      .select({ players: countDistinct(wordleSessions.user_id) })
      .from(wordleSessions)
      .where(
        and(
          eq(wordleSessions.guild_id, guildId),
          eq(wordleSessions.achievement_version, version),
          gt(wordleSessions.attempts, 0),
        ),
      );
    const percentages = new Map<string, number>();
    if (!total?.players) return { percentages, hasPlayers: false };
    const holders = await exec
      .select({
        id: userAchievements.achievement_id,
        holders: countDistinct(userAchievements.user_id),
      })
      .from(userAchievements)
      .innerJoin(
        achievements,
        eq(achievements.id, userAchievements.achievement_id),
      )
      .where(
        and(
          eq(userAchievements.guild_id, guildId),
          isNull(achievements.archived_at),
          sql`EXISTS (
        SELECT 1 FROM ${wordleSessions}
        WHERE ${wordleSessions.user_id} = ${userAchievements.user_id}
          AND ${wordleSessions.guild_id} = ${userAchievements.guild_id}
          AND ${wordleSessions.achievement_version} = ${version}
          AND ${wordleSessions.attempts} > 0
      )`,
        ),
      )
      .groupBy(userAchievements.achievement_id);
    for (const row of holders)
      percentages.set(
        row.id,
        Math.round((row.holders / total.players) * 10000) / 100,
      );
    return { percentages, hasPlayers: true };
  }

  private async snapshot(
    userId: string,
    guildId: string,
    version: number,
    history: Awaited<ReturnType<WordleAchievementService['loadHistory']>>,
    evidence: Map<string, WordlePatternEvidence>,
    exec: DbExecutor,
  ) {
    if (version !== WORDLE_ACHIEVEMENT_VERSION) {
      return wordleAchievementsOverviewSchema.parse({
        achievementVersion: version,
        achievements: [],
        stats: computeWordlePlayerStats(history.days, history.options),
      });
    }
    const days = history.days.filter(
      (day) => day.achievementVersion === version,
    );
    const evaluations = evaluateWordleAchievements(days, {
      today: history.options.today,
      timeZone: history.options.timeZone,
      discoveryIds: new Set(evidence.keys()),
    });
    const progress = new Map(evaluations.map((row) => [row.id, row.progress]));
    const unlocks = new Map(
      (await this.loadUnlocks(userId, guildId, version, exec)).map((row) => [
        row.id,
        row.at,
      ]),
    );
    const { percentages, hasPlayers } = await this.holderPercentages(
      guildId,
      version,
      exec,
    );
    const archived = new Set(
      (
        await exec
          .select({ id: achievements.id })
          .from(achievements)
          .where(isNotNull(achievements.archived_at))
      ).map((row) => row.id),
    );
    const collection = WORDLE_ACHIEVEMENT_CATALOG.filter(
      (definition) => !archived.has(definition.id),
    ).map((definition) => {
      const at = unlocks.get(definition.id);
      const concealed = definition.hidden && at === undefined;
      const patternId =
        definition.rule.kind === 'pattern'
          ? definition.rule.patternId
          : undefined;
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
        holdersPercent: hasPlayers
          ? (percentages.get(definition.id) ?? 0)
          : null,
        ...(patternId && !concealed
          ? {
              patternPreview: getWordlePatternPreview(patternId),
              matchEvidence:
                at === undefined ? null : (evidence.get(patternId) ?? null),
            }
          : {}),
      };
    });
    return wordleAchievementsOverviewSchema.parse({
      achievementVersion: version,
      achievements: collection,
      stats: computeWordlePlayerStats(history.days, history.options),
    });
  }

  async getOverview(
    userId: string,
    guildId: string,
    exec: DbExecutor = db,
  ): Promise<WordleAchievementsOverview> {
    if (exec === db)
      return db.transaction((tx) => this.getOverview(userId, guildId, tx));
    const version = await getActiveWordleAchievementVersion(exec, 'share');
    const history = await this.loadHistory(userId, guildId, exec);
    const evidence = await this.loadDiscoveries(userId, guildId, version, exec);
    return this.snapshot(userId, guildId, version, history, evidence, exec);
  }

  async getAchievements(
    userId: string,
    guildId: string,
    exec: DbExecutor = db,
  ): Promise<WordleAchievementStatus[]> {
    return (await this.getOverview(userId, guildId, exec)).achievements;
  }

  async checkAndAward(
    userId: string,
    guildId: string,
    exec: DbExecutor,
  ): Promise<AwardResult> {
    const version = await getActiveWordleAchievementVersion(exec, 'share');
    await exec.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify(['wordle-achievements', userId, guildId, version])}, 0))`,
    );
    const history = await this.loadHistory(userId, guildId, exec);
    if (version === WORDLE_ACHIEVEMENT_VERSION) {
      const eligibleDays = history.days.filter(
        (day) => day.achievementVersion === version,
      );
      const sessionIdsByDate = new Map(
        eligibleDays.map((day) => [day.date, day.sessionId]),
      );
      const discoveries = discoverWordlePatterns(eligibleDays, {
        today: history.options.today,
      });
      if (discoveries.length > 0) {
        const discoveryRows = discoveries.map((evidence) => {
          const sessionId = sessionIdsByDate.get(evidence.date);
          if (sessionId === undefined)
            throw new Error(
              `Wordle pattern evidence has no source session for ${evidence.date}`,
            );
          return { evidence, sessionId };
        });
        await exec
          .insert(wordlePatternDiscoveries)
          .values(
            discoveryRows.map(({ evidence, sessionId }) => ({
              user_id: userId,
              guild_id: guildId,
              version,
              pattern_id: evidence.patternId,
              session_id: sessionId,
              discovered_at: Date.now(),
              evidence: wordlePatternEvidenceSchema.parse(evidence),
            })),
          )
          .onConflictDoNothing();
      }
    }
    const evidence = await this.loadDiscoveries(userId, guildId, version, exec);
    const days = history.days.filter(
      (day) => day.achievementVersion === version,
    );
    const unlocked = new Set<string>();
    const earned = new Set(
      (await this.loadUnlocks(userId, guildId, version, exec)).map(
        (row) => row.id,
      ),
    );
    if (version === WORDLE_ACHIEVEMENT_VERSION) {
      const evaluations = evaluateWordleAchievements(days, {
        today: history.options.today,
        timeZone: history.options.timeZone,
        discoveryIds: new Set(evidence.keys()),
      });
      for (const evaluation of evaluations) {
        if (
          evaluation.met &&
          !earned.has(evaluation.id) &&
          (await this.awards.unlockAchievement(
            userId,
            guildId,
            evaluation.id,
            exec,
          ))
        )
          unlocked.add(evaluation.id);
      }
    }
    const overview = await this.snapshot(
      userId,
      guildId,
      version,
      history,
      evidence,
      exec,
    );
    return {
      ...overview,
      achievementProgress: overview.achievements.map(({ id, progress }) => ({
        id,
        progress,
      })),
      unlockedAchievements: overview.achievements
        .filter((row) => unlocked.has(row.id))
        .map((row) => wordleUnlockedAchievementSchema.parse(row)),
    };
  }

  async backfill(input: z.input<typeof backfillOptionsSchema> = {}) {
    const options = backfillOptionsSchema.parse(input);
    await this.awards.initializeDefaults();
    let cursor: { guildId: string; userId: string } | undefined;
    let playersProcessed = 0,
      achievementsAwarded = 0;
    while (true) {
      const players = await db
        .selectDistinct({
          guildId: wordleSessions.guild_id,
          userId: wordleSessions.user_id,
        })
        .from(wordleSessions)
        .where(
          and(
            gt(wordleSessions.attempts, 0),
            options.guildId
              ? eq(wordleSessions.guild_id, options.guildId)
              : undefined,
            cursor
              ? or(
                  gt(wordleSessions.guild_id, cursor.guildId),
                  and(
                    eq(wordleSessions.guild_id, cursor.guildId),
                    gt(wordleSessions.user_id, cursor.userId),
                  ),
                )
              : undefined,
          ),
        )
        .orderBy(asc(wordleSessions.guild_id), asc(wordleSessions.user_id))
        .limit(options.batchSize);
      if (players.length === 0) break;
      for (const player of players) {
        const result = await db.transaction((tx) =>
          this.checkAndAward(player.userId, player.guildId, tx),
        );
        playersProcessed++;
        achievementsAwarded += result.unlockedAchievements.length;
        cursor = player;
      }
    }
    return { playersProcessed, achievementsAwarded };
  }
}
