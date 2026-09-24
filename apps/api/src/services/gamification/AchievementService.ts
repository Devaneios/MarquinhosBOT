import {
  achievementConditionSchema,
  type AchievementCondition,
} from '@marquinhos/contracts/http/routes/gamification';
import { db, type DbExecutor } from '@marquinhos/database/client';
import {
  achievements,
  userAchievements,
  userLevels,
  userStats,
} from '@marquinhos/database/schema';
import { and, asc, count, desc, eq, isNull } from 'drizzle-orm';
import { LevelingService } from 'services/gamification/LevelingService';
import type { Achievement, UserAchievement } from 'services/gamification/types';

const DEFAULT_ACHIEVEMENTS = [
  {
    id: 'first_command',
    name: 'Primeiro Passo',
    description: 'Execute seu primeiro comando',
    category: 'commands',
    rarity: 'common',
    icon: '👋',
    condition: { type: 'commands', threshold: 1 },
    reward_xp: 10,
  },
  {
    id: 'commands_10',
    name: 'Iniciante',
    description: 'Execute 10 comandos',
    category: 'commands',
    rarity: 'common',
    icon: '⚡',
    condition: { type: 'commands', threshold: 10 },
    reward_xp: 50,
  },
  {
    id: 'commands_100',
    name: 'Veterano',
    description: 'Execute 100 comandos',
    category: 'commands',
    rarity: 'rare',
    icon: '🏆',
    condition: { type: 'commands', threshold: 100 },
    reward_xp: 200,
  },
  {
    id: 'level_10',
    name: 'Escalador',
    description: 'Alcance o nível 10',
    category: 'levels',
    rarity: 'rare',
    icon: '🧗',
    condition: { type: 'level', threshold: 10 },
    reward_xp: 500,
  },
  {
    id: 'music_lover',
    name: 'Amante da Música',
    description: 'Registre 50 scrobbles',
    category: 'music',
    rarity: 'epic',
    icon: '🎵',
    condition: { type: 'scrobbles', threshold: 50 },
    reward_xp: 300,
  },
  {
    id: 'scrobbles_100',
    name: 'DJ Marquinhos',
    description: 'Registre 100 scrobbles',
    category: 'music',
    rarity: 'epic',
    icon: '📊',
    condition: { type: 'scrobbles', threshold: 100 },
    reward_xp: 400,
  },
];

export class AchievementService {
  private levelingService: LevelingService;

  constructor(levelingService: LevelingService) {
    this.levelingService = levelingService;
  }

  async initializeDefaults(): Promise<void> {
    const [row] = await db.select({ count: count() }).from(achievements);
    if (row && row.count > 0) return;
    await db
      .insert(achievements)
      .values(
        DEFAULT_ACHIEVEMENTS.map((a) => ({
          ...a,
          condition: JSON.stringify(a.condition),
        })),
      )
      .onConflictDoNothing();
    console.log('Default achievements seeded');
  }

  async checkAndAwardAchievements(
    userId: string,
    guildId: string,
    exec: DbExecutor = db,
  ): Promise<string[]> {
    const [stats] = await exec
      .select()
      .from(userStats)
      .where(
        and(eq(userStats.user_id, userId), eq(userStats.guild_id, guildId)),
      );

    const [userLevel] = await exec
      .select()
      .from(userLevels)
      .where(
        and(eq(userLevels.user_id, userId), eq(userLevels.guild_id, guildId)),
      );

    if (!stats || !userLevel) return [];

    const candidates = (await exec
      .select({
        id: achievements.id,
        name: achievements.name,
        description: achievements.description,
        category: achievements.category,
        rarity: achievements.rarity,
        icon: achievements.icon,
        condition: achievements.condition,
        reward_xp: achievements.reward_xp,
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
      .where(isNull(userAchievements.achievement_id))) as Achievement[];

    const unlocked: string[] = [];

    for (const achievement of candidates) {
      let condition: AchievementCondition;
      try {
        condition = achievementConditionSchema.parse(
          JSON.parse(achievement.condition),
        );
      } catch (e) {
        console.error(
          `[gamification] Malformed condition on achievement '${achievement.id}':`,
          e,
        );
        continue;
      }

      let met = false;

      switch (condition.type) {
        case 'commands':
          met = stats.total_commands >= condition.threshold;
          break;
        case 'scrobbles':
          met = stats.total_scrobbles >= condition.threshold;
          break;
        case 'level':
          met = userLevel.level >= condition.threshold;
          break;
        case 'games_won':
          met = stats.games_won >= condition.threshold;
          break;
        case 'total_games':
          met = stats.total_games >= condition.threshold;
          break;
      }

      if (
        met &&
        (await this.unlockAchievement(userId, guildId, achievement.id, exec))
      ) {
        unlocked.push(achievement.id);
      }
    }

    return unlocked;
  }

  async unlockAchievement(
    userId: string,
    guildId: string,
    achievementId: string,
    exec: DbExecutor = db,
  ): Promise<boolean> {
    await this.levelingService.ensureUser(userId, guildId, exec);

    const [achievement] = await exec
      .select()
      .from(achievements)
      .where(eq(achievements.id, achievementId));

    if (!achievement) return false;

    // The primary key decides the race: only the insert that lands awards XP.
    const inserted = await exec
      .insert(userAchievements)
      .values({
        user_id: userId,
        guild_id: guildId,
        achievement_id: achievementId,
        unlocked_at: Date.now(),
      })
      .onConflictDoNothing()
      .returning({ id: userAchievements.achievement_id });

    if (inserted.length === 0) return false;

    if (achievement.reward_xp > 0) {
      await this.levelingService.addXpToUser(
        userId,
        guildId,
        achievement.reward_xp,
        exec,
        null,
      );
      await this.levelingService.applyLevelUps(userId, guildId, exec);
    }

    return true;
  }

  async getUserAchievements(
    userId: string,
    guildId: string,
  ): Promise<UserAchievement[]> {
    return (await db
      .select({
        user_id: userAchievements.user_id,
        guild_id: userAchievements.guild_id,
        achievement_id: userAchievements.achievement_id,
        unlocked_at: userAchievements.unlocked_at,
        name: achievements.name,
        description: achievements.description,
        category: achievements.category,
        rarity: achievements.rarity,
        icon: achievements.icon,
        reward_xp: achievements.reward_xp,
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
        ),
      )
      .orderBy(desc(userAchievements.unlocked_at))) as UserAchievement[];
  }

  async getAllAchievements(): Promise<Achievement[]> {
    return (await db
      .select()
      .from(achievements)
      .orderBy(
        asc(achievements.rarity),
        asc(achievements.id),
      )) as Achievement[];
  }

  async createAchievement(data: {
    id: string;
    name: string;
    description: string;
    category: string;
    rarity: string;
    icon: string;
    condition: AchievementCondition;
    reward_xp: number;
  }): Promise<Achievement> {
    const [row] = await db
      .insert(achievements)
      .values({ ...data, condition: JSON.stringify(data.condition) })
      .returning();
    return row as Achievement;
  }
}
