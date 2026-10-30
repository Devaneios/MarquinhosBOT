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
import { WORDLE_ACHIEVEMENT_CATALOG } from '@marquinhos/domain/games/wordle/achievements/catalog';
import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNull,
  ne,
  sql,
} from 'drizzle-orm';
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
    // Generic defaults are seeded once; after that the rows are the operator's.
    const [generic] = await db
      .select({ count: count() })
      .from(achievements)
      .where(ne(achievements.category, 'wordle'));
    if (!generic?.count) {
      await db
        .insert(achievements)
        .values(
          DEFAULT_ACHIEVEMENTS.map((a) => ({
            ...a,
            condition: JSON.stringify(a.condition),
          })),
        )
        .onConflictDoNothing();
    }
    await db
      .insert(achievements)
      .values(
        WORDLE_ACHIEVEMENT_CATALOG.map((definition) => ({
          id: definition.id,
          name: definition.name,
          description: definition.description,
          category: 'wordle',
          rarity: definition.rarity,
          icon: definition.icon,
          condition: null,
          reward_xp: definition.rewardXp,
          archived_at: null,
        })),
      )
      .onConflictDoUpdate({
        target: achievements.id,
        set: {
          name: sql`excluded.name`,
          description: sql`excluded.description`,
          category: sql`excluded.category`,
          rarity: sql`excluded.rarity`,
          icon: sql`excluded.icon`,
          condition: sql`excluded.condition`,
          reward_xp: sql`excluded.reward_xp`,
          archived_at: null,
        },
      });
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
      .where(
        and(
          isNull(userAchievements.achievement_id),
          ne(achievements.category, 'wordle'),
          isNull(achievements.archived_at),
        ),
      )) as Achievement[];

    const unlocked: string[] = [];

    for (const achievement of candidates) {
      let condition: AchievementCondition;
      try {
        if (achievement.condition === null)
          throw new Error('Generic achievement condition is missing');
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
    return (
      (await this.unlockAchievements(userId, guildId, [achievementId], exec))
        .length > 0
    );
  }

  async unlockAchievements(
    userId: string,
    guildId: string,
    achievementIds: readonly string[],
    exec: DbExecutor = db,
  ): Promise<readonly { id: string; unlockedAt: number }[]> {
    if (exec === db)
      return db.transaction((tx) =>
        this.unlockAchievements(userId, guildId, achievementIds, tx),
      );
    const requestedIds = [...new Set(achievementIds)];
    if (requestedIds.length === 0) return [];

    const definitions = await exec
      .select({ id: achievements.id, reward_xp: achievements.reward_xp })
      .from(achievements)
      .where(
        and(
          inArray(achievements.id, requestedIds),
          isNull(achievements.archived_at),
        ),
      );
    const eligibleIds = new Set(definitions.map((row) => row.id));
    const rewardById = new Map(
      definitions.map((row) => [row.id, row.reward_xp]),
    );
    const eligible = requestedIds.filter((id) => eligibleIds.has(id));
    if (eligible.length === 0) return [];

    await this.levelingService.ensureUser(userId, guildId, exec);

    const inserted = await exec
      .insert(userAchievements)
      .values(
        eligible.map((id) => ({
          user_id: userId,
          guild_id: guildId,
          achievement_id: id,
          unlocked_at: Date.now(),
        })),
      )
      .onConflictDoNothing()
      .returning({
        id: userAchievements.achievement_id,
        unlockedAt: userAchievements.unlocked_at,
      });

    if (inserted.length === 0) return [];

    const insertedIds = new Set(inserted.map((row) => row.id));
    const rewardXp = eligible.reduce(
      (total, id) =>
        insertedIds.has(id)
          ? total + Math.max(0, rewardById.get(id) ?? 0)
          : total,
      0,
    );
    if (rewardXp > 0) {
      await this.levelingService.addXpToUser(
        userId,
        guildId,
        rewardXp,
        exec,
        null,
      );
      await this.levelingService.applyLevelUps(userId, guildId, exec);
    }

    const insertedById = new Map(inserted.map((row) => [row.id, row]));
    return eligible.flatMap((id) => {
      const row = insertedById.get(id);
      return row ? [{ id: row.id, unlockedAt: row.unlockedAt }] : [];
    });
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
          isNull(achievements.archived_at),
        ),
      )
      .orderBy(desc(userAchievements.unlocked_at))) as UserAchievement[];
  }

  async getAllAchievements(): Promise<Achievement[]> {
    return (await db
      .select()
      .from(achievements)
      .where(isNull(achievements.archived_at))
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
