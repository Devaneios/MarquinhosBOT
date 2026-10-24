import {
  wordleAchievementStatusSchema,
  wordleUnlockedAchievementSchema,
  type WordleAchievementStatus,
  type WordleUnlockedAchievement,
} from '@marquinhos/contracts/wordle';
import { db, type DbExecutor } from '@marquinhos/database/client';
import {
  achievements,
  userAchievements,
  wordleSessions,
  wordleStreaks,
} from '@marquinhos/database/schema';
import { and, asc, eq, gt } from 'drizzle-orm';
import { AchievementService } from 'services/gamification/AchievementService';
import { LevelingService } from 'services/gamification/LevelingService';
import { z } from 'zod';

const conditionSchema = z.object({
  type: z.enum([
    'wordle_wins',
    'wordle_streak',
    'wordle_solved_in',
    'wordle_played',
  ]),
  threshold: z.number().int().positive(),
});

export class WordleAchievementService {
  private readonly awards = new AchievementService(new LevelingService());

  private loadAchievements(userId: string, guildId: string, exec: DbExecutor) {
    return exec
      .select({
        id: achievements.id,
        name: achievements.name,
        description: achievements.description,
        icon: achievements.icon,
        rarity: achievements.rarity,
        rewardXp: achievements.reward_xp,
        condition: achievements.condition,
        unlockedAt: userAchievements.unlocked_at,
      })
      .from(achievements)
      .leftJoin(
        userAchievements,
        and(
          eq(userAchievements.achievement_id, achievements.id),
          eq(userAchievements.user_id, userId),
          eq(userAchievements.guild_id, guildId),
        ),
      )
      .where(eq(achievements.category, 'wordle'))
      .orderBy(asc(achievements.id));
  }

  async getAchievements(
    userId: string,
    guildId: string,
    exec: DbExecutor = db,
  ): Promise<WordleAchievementStatus[]> {
    const rows = await this.loadAchievements(userId, guildId, exec);
    return rows.map((row) =>
      wordleAchievementStatusSchema.parse({
        ...row,
        unlockedAt:
          row.unlockedAt === null
            ? null
            : new Date(row.unlockedAt).toISOString(),
      }),
    );
  }

  async checkAndAward(
    userId: string,
    guildId: string,
    exec: DbExecutor,
  ): Promise<WordleUnlockedAchievement[]> {
    const candidates = (
      await this.loadAchievements(userId, guildId, exec)
    ).filter((row) => row.unlockedAt === null);
    if (candidates.length === 0) return [];

    const history = await exec
      .select({
        date: wordleSessions.word_date,
        solved: wordleSessions.solved,
        attempts: wordleSessions.attempts,
      })
      .from(wordleSessions)
      .where(
        and(
          eq(wordleSessions.user_id, userId),
          eq(wordleSessions.guild_id, guildId),
          gt(wordleSessions.attempts, 0),
        ),
      )
      .orderBy(asc(wordleSessions.word_date));
    const [savedStreak] = await exec
      .select({
        current: wordleStreaks.current_streak,
        best: wordleStreaks.max_streak,
      })
      .from(wordleStreaks)
      .where(
        and(
          eq(wordleStreaks.user_id, userId),
          eq(wordleStreaks.guild_id, guildId),
        ),
      );

    let wins = 0;
    let bestAttempts = Infinity;
    let streak = 0;
    let bestStreak = Math.max(
      savedStreak?.current ?? 0,
      savedStreak?.best ?? 0,
    );
    let previousSolvedDay = -Infinity;
    for (const day of history) {
      if (!day.solved) continue;
      wins++;
      bestAttempts = Math.min(bestAttempts, day.attempts);
      const timestamp = Date.parse(`${day.date}T00:00:00Z`);
      streak = timestamp - previousSolvedDay === 86_400_000 ? streak + 1 : 1;
      previousSolvedDay = timestamp;
      bestStreak = Math.max(bestStreak, streak);
    }

    const unlocked: string[] = [];
    for (const candidate of candidates) {
      let raw: unknown;
      try {
        raw = JSON.parse(candidate.condition);
      } catch {
        continue;
      }
      const parsed = conditionSchema.safeParse(raw);
      if (!parsed.success) continue;
      const { type, threshold } = parsed.data;
      let met: boolean;
      switch (type) {
        case 'wordle_wins':
          met = wins >= threshold;
          break;
        case 'wordle_streak':
          met = bestStreak >= threshold;
          break;
        case 'wordle_solved_in':
          met = bestAttempts <= threshold;
          break;
        case 'wordle_played':
          met = history.length >= threshold;
          break;
      }
      if (
        met &&
        (await this.awards.unlockAchievement(
          userId,
          guildId,
          candidate.id,
          exec,
        ))
      ) {
        unlocked.push(candidate.id);
      }
    }
    if (unlocked.length === 0) return [];
    const collection = await this.getAchievements(userId, guildId, exec);
    return collection
      .filter((row) => unlocked.includes(row.id))
      .map((row) => wordleUnlockedAchievementSchema.parse(row));
  }
}
