import { db } from 'database/sqlite';
import { LevelingService } from 'services/gamification/LevelingService';
import type {
  Achievement,
  UserAchievement,
  UserLevel,
  UserStats,
} from 'services/gamification/types';

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

  initializeDefaults(): void {
    const achievCount = db
      .query<{ count: number }, []>(
        'SELECT COUNT(*) as count FROM achievements',
      )
      .get();
    if (!achievCount || achievCount.count === 0) {
      const insertAchiev = db.prepare(
        'INSERT OR IGNORE INTO achievements (id, name, description, category, rarity, icon, condition, reward_xp) VALUES ($id, $name, $description, $category, $rarity, $icon, $condition, $reward_xp)',
      );
      for (const a of DEFAULT_ACHIEVEMENTS) {
        insertAchiev.run({
          $id: a.id,
          $name: a.name,
          $description: a.description,
          $category: a.category,
          $rarity: a.rarity,
          $icon: a.icon,
          $condition: JSON.stringify(a.condition),
          $reward_xp: a.reward_xp,
        });
      }
      console.log('Default achievements seeded');
    }
  }

  checkAndAwardAchievements(userId: string, guildId: string): string[] {
    const stats = db
      .query<UserStats, { $userId: string; $guildId: string }>(
        'SELECT * FROM user_stats WHERE user_id = $userId AND guild_id = $guildId',
      )
      .get({ $userId: userId, $guildId: guildId });

    const userLevel = db
      .query<UserLevel, { $userId: string; $guildId: string }>(
        'SELECT * FROM user_levels WHERE user_id = $userId AND guild_id = $guildId',
      )
      .get({ $userId: userId, $guildId: guildId });

    if (!stats || !userLevel) return [];

    const candidates = db
      .query<Achievement, { $userId: string; $guildId: string }>(
        `SELECT a.*
         FROM achievements a
         LEFT JOIN user_achievements ua
           ON ua.achievement_id = a.id
           AND ua.user_id = $userId
           AND ua.guild_id = $guildId
         WHERE ua.achievement_id IS NULL`,
      )
      .all({ $userId: userId, $guildId: guildId });

    const unlocked: string[] = [];

    for (const achievement of candidates) {
      let condition: { type: string; threshold: number };
      try {
        const parsed = JSON.parse(achievement.condition);
        if (
          !parsed ||
          typeof parsed !== 'object' ||
          typeof parsed.type !== 'string' ||
          typeof parsed.threshold !== 'number'
        ) {
          throw new Error('Invalid condition schema');
        }
        condition = parsed as { type: string; threshold: number };
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

      if (met) {
        this.unlockAchievement(userId, guildId, achievement.id);
        unlocked.push(achievement.id);
      }
    }

    return unlocked;
  }

  unlockAchievement(
    userId: string,
    guildId: string,
    achievementId: string,
  ): boolean {
    this.levelingService.ensureUser(userId, guildId);

    const achievement = db
      .query<Achievement, { $id: string }>(
        'SELECT * FROM achievements WHERE id = $id',
      )
      .get({ $id: achievementId });

    if (!achievement) return false;

    const existing = db
      .query<
        { n: number },
        { $userId: string; $guildId: string; $achievementId: string }
      >(
        'SELECT 1 as n FROM user_achievements WHERE user_id = $userId AND guild_id = $guildId AND achievement_id = $achievementId',
      )
      .get({
        $userId: userId,
        $guildId: guildId,
        $achievementId: achievementId,
      });

    if (existing) return false;

    db.query(
      'INSERT INTO user_achievements (user_id, guild_id, achievement_id, unlocked_at) VALUES ($userId, $guildId, $achievementId, $now)',
    ).run({
      $userId: userId,
      $guildId: guildId,
      $achievementId: achievementId,
      $now: Date.now(),
    });

    if (achievement.reward_xp > 0) {
      db.query(
        'UPDATE user_levels SET xp = xp + $amount, total_xp = total_xp + $amount WHERE user_id = $userId AND guild_id = $guildId',
      ).run({
        $amount: achievement.reward_xp,
        $userId: userId,
        $guildId: guildId,
      });
      this.levelingService.applyLevelUps(userId, guildId);
    }

    return true;
  }

  getUserAchievements(userId: string, guildId: string): UserAchievement[] {
    return db
      .query<UserAchievement, { $userId: string; $guildId: string }>(
        `SELECT ua.user_id, ua.guild_id, ua.achievement_id, ua.unlocked_at,
                a.name, a.description, a.category, a.rarity, a.icon, a.reward_xp
         FROM user_achievements ua
         JOIN achievements a ON a.id = ua.achievement_id
         WHERE ua.user_id = $userId AND ua.guild_id = $guildId
         ORDER BY ua.unlocked_at DESC`,
      )
      .all({ $userId: userId, $guildId: guildId });
  }

  getAllAchievements(): Achievement[] {
    return db
      .query<Achievement, []>('SELECT * FROM achievements ORDER BY rarity, id')
      .all();
  }

  createAchievement(data: {
    id: string;
    name: string;
    description: string;
    category: string;
    rarity: string;
    icon: string;
    condition: object;
    reward_xp: number;
  }): Achievement {
    db.query(
      'INSERT INTO achievements (id, name, description, category, rarity, icon, condition, reward_xp) VALUES ($id, $name, $description, $category, $rarity, $icon, $condition, $reward_xp)',
    ).run({
      $id: data.id,
      $name: data.name,
      $description: data.description,
      $category: data.category,
      $rarity: data.rarity,
      $icon: data.icon,
      $condition: JSON.stringify(data.condition),
      $reward_xp: data.reward_xp,
    });
    return db
      .query<Achievement, { $id: string }>(
        'SELECT * FROM achievements WHERE id = $id',
      )
      .get({ $id: data.id })!;
  }
}
