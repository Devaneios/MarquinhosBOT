import { db, type DbExecutor } from '@marquinhos/database/client';
import { userLevels, userStats, xpConfig } from '@marquinhos/database/schema';
import {
  DEFAULT_XP_CONFIG,
  requiredXpForLevel,
} from '@marquinhos/domain/gamification/leveling';
import { and, count, desc, eq, sql } from 'drizzle-orm';
import type { UserLevel, XpConfig } from 'services/gamification/types';

const byUser = (userId: string, guildId: string) =>
  and(eq(userLevels.user_id, userId), eq(userLevels.guild_id, guildId));

export class LevelingService {
  async initializeDefaults(): Promise<void> {
    const [row] = await db.select({ count: count() }).from(xpConfig);
    if (row && row.count > 0) return;
    await db
      .insert(xpConfig)
      .values(DEFAULT_XP_CONFIG.map((c) => ({ ...c })))
      .onConflictDoNothing();
    console.log('XP config seeded');
  }

  async getXpConfig(): Promise<XpConfig[]> {
    return db.select().from(xpConfig);
  }

  async ensureUser(
    userId: string,
    guildId: string,
    exec: DbExecutor = db,
  ): Promise<void> {
    await exec
      .insert(userLevels)
      .values({ user_id: userId, guild_id: guildId })
      .onConflictDoNothing();
    await exec
      .insert(userStats)
      .values({ user_id: userId, guild_id: guildId })
      .onConflictDoNothing();
  }

  async getUserLevel(
    userId: string,
    guildId: string,
    exec: DbExecutor = db,
  ): Promise<UserLevel> {
    await this.ensureUser(userId, guildId, exec);
    const [row] = await exec
      .select()
      .from(userLevels)
      .where(byUser(userId, guildId));
    return row!;
  }

  async applyLevelUps(
    userId: string,
    guildId: string,
    exec: DbExecutor = db,
  ): Promise<boolean> {
    // On a transaction this nests as a savepoint.
    return exec.transaction((tx) => this.lockAndLevelUp(userId, guildId, tx));
  }

  private async lockAndLevelUp(
    userId: string,
    guildId: string,
    tx: DbExecutor,
  ): Promise<boolean> {
    // The row lock stops two concurrent level-ups from both subtracting the
    // same threshold.
    const [row] = await tx
      .select()
      .from(userLevels)
      .where(byUser(userId, guildId))
      .for('update');
    if (!row) return false;

    let { level, xp } = row;
    while (xp >= requiredXpForLevel(level)) {
      xp -= requiredXpForLevel(level);
      level += 1;
    }
    if (level === row.level) return false;

    await tx
      .update(userLevels)
      .set({ level, xp })
      .where(byUser(userId, guildId));
    return true;
  }

  async getLeaderboard(
    guildId: string,
    limit: number = 10,
  ): Promise<UserLevel[]> {
    return db
      .select()
      .from(userLevels)
      .where(eq(userLevels.guild_id, guildId))
      .orderBy(desc(userLevels.level), desc(userLevels.total_xp))
      .limit(limit);
  }

  async addXpToUser(
    userId: string,
    guildId: string,
    amount: number,
    exec: DbExecutor = db,
    gainedAt: number | null = Date.now(),
  ): Promise<void> {
    await exec
      .update(userLevels)
      .set({
        xp: sql`${userLevels.xp} + ${amount}`,
        total_xp: sql`${userLevels.total_xp} + ${amount}`,
        ...(gainedAt === null ? {} : { last_xp_gain: gainedAt }),
      })
      .where(byUser(userId, guildId));
  }
}
