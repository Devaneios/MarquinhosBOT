import { db } from '@marquinhos/database/sqlite';
import {
  DEFAULT_XP_CONFIG,
  requiredXpForLevel,
} from '@marquinhos/domain/gamification/leveling';
import type { UserLevel, XpConfig } from 'services/gamification/types';

export class LevelingService {
  initializeDefaults(): void {
    const configCount = db
      .query<{ count: number }, []>('SELECT COUNT(*) as count FROM xp_config')
      .get();
    if (!configCount || configCount.count === 0) {
      const insertConfig = db.prepare(
        'INSERT OR IGNORE INTO xp_config (event_type, xp_amount, cooldown_ms) VALUES ($event_type, $xp_amount, $cooldown_ms)',
      );
      for (const c of DEFAULT_XP_CONFIG) {
        insertConfig.run({
          $event_type: c.event_type,
          $xp_amount: c.xp_amount,
          $cooldown_ms: c.cooldown_ms,
        });
      }
      console.log('XP config seeded');
    }
  }

  getXpConfig(): XpConfig[] {
    return db.query<XpConfig, []>('SELECT * FROM xp_config').all();
  }

  ensureUser(userId: string, guildId: string): void {
    db.query(
      'INSERT OR IGNORE INTO user_levels (user_id, guild_id) VALUES ($userId, $guildId)',
    ).run({
      $userId: userId,
      $guildId: guildId,
    });
    db.query(
      'INSERT OR IGNORE INTO user_stats (user_id, guild_id) VALUES ($userId, $guildId)',
    ).run({
      $userId: userId,
      $guildId: guildId,
    });
  }

  getUserLevel(userId: string, guildId: string): UserLevel {
    this.ensureUser(userId, guildId);
    return db
      .query<UserLevel, { $userId: string; $guildId: string }>(
        'SELECT * FROM user_levels WHERE user_id = $userId AND guild_id = $guildId',
      )
      .get({ $userId: userId, $guildId: guildId })!;
  }

  applyLevelUps(userId: string, guildId: string): boolean {
    const fn = db.transaction(() => {
      let leveled = false;
      let row = db
        .query<UserLevel, { $userId: string; $guildId: string }>(
          'SELECT * FROM user_levels WHERE user_id = $userId AND guild_id = $guildId',
        )
        .get({ $userId: userId, $guildId: guildId })!;

      while (row.xp >= requiredXpForLevel(row.level)) {
        const required = requiredXpForLevel(row.level);
        db.query(
          'UPDATE user_levels SET level = level + 1, xp = xp - $required WHERE user_id = $userId AND guild_id = $guildId',
        ).run({ $required: required, $userId: userId, $guildId: guildId });
        row = db
          .query<UserLevel, { $userId: string; $guildId: string }>(
            'SELECT * FROM user_levels WHERE user_id = $userId AND guild_id = $guildId',
          )
          .get({ $userId: userId, $guildId: guildId })!;
        leveled = true;
      }
      return leveled;
    });
    return fn();
  }

  getLeaderboard(guildId: string, limit: number = 10): UserLevel[] {
    return db
      .query<UserLevel, { $guildId: string; $limit: number }>(
        'SELECT * FROM user_levels WHERE guild_id = $guildId ORDER BY level DESC, total_xp DESC LIMIT $limit',
      )
      .all({ $guildId: guildId, $limit: limit });
  }
}
