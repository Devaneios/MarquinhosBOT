import {
  guessRowSchema,
  wordleAchievementsOverviewSchema,
  wordleUnlockedAchievementSchema,
  type WordleAchievementProgressUpdate,
  type WordleAchievementsOverview,
  type WordleAchievementStatus,
  type WordleUnlockedAchievement,
} from '@marquinhos/contracts/wordle';
import { db, type DbExecutor } from '@marquinhos/database/client';
import {
  userAchievements,
  wordleSessions,
  wordleStreaks,
} from '@marquinhos/database/schema';
import { WORDLE_ACHIEVEMENT_CATALOG } from '@marquinhos/domain/games/wordle/achievements/catalog';
import { evaluateWordleAchievements } from '@marquinhos/domain/games/wordle/achievements/evaluate';
import {
  computeWordlePlayerStats,
  type WordleDayRecord,
} from '@marquinhos/domain/games/wordle/achievements/stats';
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
import { getRecifeDate, getWordleTimeZone } from 'services/wordle/wordleDate';
import { z } from 'zod';

const backfillOptionsSchema = z.object({
  guildId: z.string().min(1).optional(),
  batchSize: z.number().int().min(1).max(1000).default(100),
});

function readGuesses(serialized: string) {
  try {
    const parsed = z.array(guessRowSchema).safeParse(JSON.parse(serialized));
    return parsed.success
      ? parsed.data.filter((row) => row.guess.length === row.feedback.length)
      : [];
  } catch {
    return [];
  }
}

export class WordleAchievementService {
  private readonly awards = new AchievementService(new LevelingService());

  async loadHistory(userId: string, guildId: string, exec: DbExecutor = db) {
    const history = await exec
      .select()
      .from(wordleSessions)
      .where(
        and(
          eq(wordleSessions.user_id, userId),
          eq(wordleSessions.guild_id, guildId),
          gt(wordleSessions.attempts, 0),
        ),
      )
      .orderBy(asc(wordleSessions.word_date));
    const solvedDates = history
      .filter((row) => row.solved && row.solved_at !== null)
      .map((row) => row.word_date);
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
    const days: WordleDayRecord[] = history.map((row) => ({
      date: row.word_date,
      solved: row.solved,
      attempts: row.attempts,
      guesses: readGuesses(row.guesses),
      startedAt: row.created_at,
      solvedAt: row.solved ? row.solved_at : null,
      firstSolverInGuild: row.solved && firstIds.has(row.id),
    }));
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

  private loadUnlocks(userId: string, guildId: string, exec: DbExecutor) {
    return exec
      .select({
        id: userAchievements.achievement_id,
        at: userAchievements.unlocked_at,
      })
      .from(userAchievements)
      .where(
        and(
          eq(userAchievements.user_id, userId),
          eq(userAchievements.guild_id, guildId),
        ),
      );
  }

  private async holderPercentages(guildId: string, exec: DbExecutor) {
    const [total] = await exec
      .select({ players: countDistinct(wordleSessions.user_id) })
      .from(wordleSessions)
      .where(
        and(
          eq(wordleSessions.guild_id, guildId),
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
      .where(
        and(
          eq(userAchievements.guild_id, guildId),
          sql`EXISTS (
            SELECT 1 FROM ${wordleSessions}
            WHERE ${wordleSessions.user_id} = ${userAchievements.user_id}
              AND ${wordleSessions.guild_id} = ${userAchievements.guild_id}
              AND ${wordleSessions.attempts} > 0
          )`,
        ),
      )
      .groupBy(userAchievements.achievement_id);
    for (const row of holders) {
      percentages.set(
        row.id,
        Math.round((row.holders / total.players) * 10000) / 100,
      );
    }
    return { percentages, hasPlayers: true };
  }

  async getOverview(
    userId: string,
    guildId: string,
    exec: DbExecutor = db,
  ): Promise<WordleAchievementsOverview> {
    const { days, options } = await this.loadHistory(userId, guildId, exec);
    const evaluations = new Map(
      evaluateWordleAchievements(days, options).map((row) => [row.id, row]),
    );
    const unlocks = new Map(
      (await this.loadUnlocks(userId, guildId, exec)).map((row) => [
        row.id,
        row.at,
      ]),
    );
    const { percentages, hasPlayers } = await this.holderPercentages(
      guildId,
      exec,
    );
    const collection = WORDLE_ACHIEVEMENT_CATALOG.map((definition) => {
      const at = unlocks.get(definition.id);
      const concealed = definition.hidden && at === undefined;
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
        progress: concealed
          ? null
          : (evaluations.get(definition.id)?.progress ?? null),
        holdersPercent: hasPlayers
          ? (percentages.get(definition.id) ?? 0)
          : null,
      };
    });
    return wordleAchievementsOverviewSchema.parse({
      achievements: collection,
      stats: computeWordlePlayerStats(days, options),
    });
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
  ): Promise<{
    unlockedAchievements: WordleUnlockedAchievement[];
    stats: WordleAchievementsOverview['stats'];
    achievementProgress: WordleAchievementProgressUpdate[];
  }> {
    const { days, options } = await this.loadHistory(userId, guildId, exec);
    const evaluations = evaluateWordleAchievements(days, options);
    const earned = new Set(
      (await this.loadUnlocks(userId, guildId, exec)).map((row) => row.id),
    );
    const unlocked = new Set<string>();
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
      ) {
        unlocked.add(evaluation.id);
      }
    }
    const stats = computeWordlePlayerStats(days, options);
    const hidden = new Set(
      WORDLE_ACHIEVEMENT_CATALOG.filter((row) => row.hidden).map(
        (row) => row.id,
      ),
    );
    const achievementProgress = evaluations.map(({ id, progress }) => ({
      id,
      progress:
        hidden.has(id) && !earned.has(id) && !unlocked.has(id)
          ? null
          : progress,
    }));
    if (unlocked.size === 0)
      return { unlockedAchievements: [], stats, achievementProgress };
    const definitions = new Map(
      WORDLE_ACHIEVEMENT_CATALOG.map((definition) => [
        definition.id,
        definition,
      ]),
    );
    const unlockedAchievements = (await this.loadUnlocks(userId, guildId, exec))
      .filter((row) => unlocked.has(row.id))
      .map((row) =>
        wordleUnlockedAchievementSchema.parse({
          ...definitions.get(row.id),
          unlockedAt: new Date(row.at).toISOString(),
        }),
      );
    return { unlockedAchievements, stats, achievementProgress };
  }

  async backfill(input: z.input<typeof backfillOptionsSchema> = {}) {
    const options = backfillOptionsSchema.parse(input);
    await this.awards.initializeDefaults();
    let cursor: { guildId: string; userId: string } | undefined;
    let playersProcessed = 0;
    let achievementsAwarded = 0;
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
        const unlocked = await db.transaction((tx) =>
          this.checkAndAward(player.userId, player.guildId, tx),
        );
        playersProcessed++;
        achievementsAwarded += unlocked.unlockedAchievements.length;
        cursor = player;
      }
    }
    return { playersProcessed, achievementsAwarded };
  }
}
