import { db } from '@marquinhos/database/client';
import {
  achievements,
  userAchievements,
  userLevels,
  userStats,
  xpConfig,
} from '@marquinhos/database/schema';
import { afterEach, beforeAll, describe, expect, it, spyOn } from 'bun:test';
import { randomUUID } from 'crypto';
import { and, eq } from 'drizzle-orm';
import { GamificationService } from 'services/gamification';
import { AchievementService } from 'services/gamification/AchievementService';
import { LevelingService } from 'services/gamification/LevelingService';

const COMMAND_XP = 5;
const COMMAND_COOLDOWN_MS = 60_000;

// Runs the real addXP against the shared test database; Date.now is pinned so
// the cooldown window is deterministic.
let nowSpy: ReturnType<typeof spyOn<DateConstructor, 'now'>> | undefined;

function at(timestamp: number) {
  nowSpy?.mockRestore();
  nowSpy = spyOn(Date, 'now').mockReturnValue(timestamp);
}

beforeAll(async () => {
  await db
    .insert(xpConfig)
    .values({
      event_type: 'command',
      xp_amount: COMMAND_XP,
      cooldown_ms: COMMAND_COOLDOWN_MS,
    })
    .onConflictDoUpdate({
      target: xpConfig.event_type,
      set: { xp_amount: COMMAND_XP, cooldown_ms: COMMAND_COOLDOWN_MS },
    });
});

afterEach(() => {
  nowSpy?.mockRestore();
  nowSpy = undefined;
});

describe('generic achievement conditions', () => {
  it('evaluates serialized conditions and grants their XP', async () => {
    const userId = `user-${randomUUID()}`;
    const guildId = `guild-${randomUUID()}`;
    const achievementId = `commands-test-${randomUUID()}`;
    const leveling = new LevelingService();
    const service = new AchievementService(leveling);
    await leveling.ensureUser(userId, guildId);
    await db
      .update(userStats)
      .set({ total_commands: 3 })
      .where(
        and(eq(userStats.user_id, userId), eq(userStats.guild_id, guildId)),
      );
    await db.insert(achievements).values({
      id: achievementId,
      name: 'Three commands',
      description: 'Run three commands.',
      category: 'commands',
      rarity: 'common',
      icon: '⚡',
      condition: JSON.stringify({ type: 'commands', threshold: 3 }),
      reward_xp: 37,
      archived_at: null,
    });

    const unlocked = await service.checkAndAwardAchievements(userId, guildId);
    const [level] = await db
      .select()
      .from(userLevels)
      .where(
        and(eq(userLevels.user_id, userId), eq(userLevels.guild_id, guildId)),
      );
    const [earned] = await db
      .select()
      .from(userAchievements)
      .where(
        and(
          eq(userAchievements.user_id, userId),
          eq(userAchievements.guild_id, guildId),
          eq(userAchievements.achievement_id, achievementId),
        ),
      );

    expect(unlocked).toContain(achievementId);
    expect(earned).toBeDefined();
    expect(level?.total_xp).toBe(37);
  });
});

describe('achievement award batches', () => {
  const leveling = new LevelingService();
  const service = new AchievementService(leveling);
  const guildId = `batch-guild-${randomUUID()}`;

  async function define(id: string, rewardXp: number, category = 'wordle') {
    await db.insert(achievements).values({
      id,
      name: id,
      description: id,
      category,
      rarity: 'common',
      icon: '🏅',
      condition:
        category === 'wordle'
          ? null
          : JSON.stringify({ type: 'commands', threshold: 999999 }),
      reward_xp: rewardXp,
      archived_at: null,
    });
  }

  async function level(userId: string) {
    const [row] = await db
      .select()
      .from(userLevels)
      .where(
        and(eq(userLevels.user_id, userId), eq(userLevels.guild_id, guildId)),
      );
    return row;
  }

  it('matches individual grants across multiple level thresholds and preserves only newly earned XP', async () => {
    const suffix = randomUUID();
    const userIds = [`batch-user-a-${suffix}`, `batch-user-b-${suffix}`];
    const [batchUser, individualUser] = userIds;
    const ids = {
      existing: `batch-existing-${suffix}`,
      first: `batch-first-${suffix}`,
      second: `batch-second-${suffix}`,
      zero: `batch-zero-${suffix}`,
      generic: `batch-generic-${suffix}`,
    };
    await define(ids.existing, 900);
    await define(ids.first, 1300);
    await define(ids.second, 2100);
    await define(ids.zero, 0);
    await define(ids.generic, 200, 'test');

    for (const userId of userIds) {
      await leveling.ensureUser(userId, guildId);
      await db
        .update(userLevels)
        .set({ level: 1, xp: 50, total_xp: 50, last_xp_gain: 123456 })
        .where(
          and(eq(userLevels.user_id, userId), eq(userLevels.guild_id, guildId)),
        );
      await db.insert(userAchievements).values({
        user_id: userId,
        guild_id: guildId,
        achievement_id: ids.existing,
        unlocked_at: 123,
      });
    }

    const requested = [
      ids.existing,
      ids.second,
      ids.first,
      ids.zero,
      ids.generic,
      ids.second,
      `missing-${suffix}`,
    ];
    const batched = await service.unlockAchievements(
      batchUser!,
      guildId,
      requested,
    );
    const individual: string[] = [];
    for (const id of requested) {
      if (await service.unlockAchievement(individualUser!, guildId, id))
        individual.push(id);
    }

    expect(batched.map(({ id }) => id)).toEqual([
      ids.second,
      ids.first,
      ids.zero,
      ids.generic,
    ]);
    expect(individual).toEqual(batched.map(({ id }) => id));
    expect(await level(batchUser!)).toMatchObject({
      level: 5,
      xp: 650,
      total_xp: 3650,
      last_xp_gain: 123456,
    });
    expect(await level(individualUser!)).toMatchObject({
      level: 5,
      xp: 650,
      total_xp: 3650,
      last_xp_gain: 123456,
    });
    expect(await service.unlockAchievements(batchUser!, guildId, [])).toEqual(
      [],
    );
    expect(
      await service.unlockAchievements(batchUser!, guildId, requested),
    ).toEqual([]);
  });

  it('preserves a concurrent generic XP contribution while a batch unlocks', async () => {
    const userId = `batch-race-${randomUUID()}`;
    const id = `batch-race-achievement-${randomUUID()}`;
    await define(id, 750);
    await leveling.ensureUser(userId, guildId);

    await Promise.all([
      db.transaction((tx) =>
        service.unlockAchievements(userId, guildId, [id], tx),
      ),
      db.transaction(async (tx) => {
        await leveling.addXpToUser(userId, guildId, 275, tx, null);
        await leveling.applyLevelUps(userId, guildId, tx);
      }),
    ]);

    expect(await level(userId)).toMatchObject({
      level: 3,
      xp: 525,
      total_xp: 1025,
    });
    expect(
      await db
        .select()
        .from(userAchievements)
        .where(
          and(
            eq(userAchievements.user_id, userId),
            eq(userAchievements.guild_id, guildId),
            eq(userAchievements.achievement_id, id),
          ),
        ),
    ).toHaveLength(1);
  });

  it('rolls back every inserted achievement and XP update, then retries once', async () => {
    const userId = `batch-rollback-${randomUUID()}`;
    const first = `batch-rollback-first-${randomUUID()}`;
    const second = `batch-rollback-second-${randomUUID()}`;
    await define(first, 400);
    await define(second, 600);
    await leveling.ensureUser(userId, guildId);

    await expect(
      db.transaction(async (tx) => {
        await service.unlockAchievements(userId, guildId, [first, second], tx);
        const [pending] = await tx
          .select()
          .from(userLevels)
          .where(
            and(
              eq(userLevels.user_id, userId),
              eq(userLevels.guild_id, guildId),
            ),
          );
        expect(pending?.total_xp).toBe(1000);
        throw new Error('rollback achievement batch');
      }),
    ).rejects.toThrow('rollback achievement batch');
    expect(await level(userId)).toMatchObject({ total_xp: 0, level: 1, xp: 0 });
    expect(
      await service.unlockAchievements(userId, guildId, [first, second]),
    ).toHaveLength(2);
    expect(await level(userId)).toMatchObject({
      total_xp: 1000,
      level: 3,
      xp: 500,
    });
    expect(
      await service.unlockAchievements(userId, guildId, [first, second]),
    ).toEqual([]);
  });
});

describe('XP cooldown logic', () => {
  const service = new GamificationService();
  const guildId = () => `guild-${randomUUID()}`;

  it('grants XP on the first addXP call', async () => {
    const result = await service.addXP(
      `user-${randomUUID()}`,
      guildId(),
      'command',
    );
    expect(result.onCooldown).toBe(false);
    expect(result.userLevel.total_xp).toBe(COMMAND_XP);
  });

  it('refuses XP when the same call is made within the cooldown window', async () => {
    const guild = guildId();
    const user = `user-${randomUUID()}`;
    const now = 1_800_000_000_000;
    at(now);
    await service.addXP(user, guild, 'command');
    at(now + 1000);
    const second = await service.addXP(user, guild, 'command');
    expect(second.onCooldown).toBe(true);
    expect(second.userLevel.total_xp).toBe(COMMAND_XP);
  });

  it('grants XP again after the cooldown expires', async () => {
    const guild = guildId();
    const user = `user-${randomUUID()}`;
    const now = 1_800_000_000_000;
    at(now);
    await service.addXP(user, guild, 'command');
    at(now + COMMAND_COOLDOWN_MS + 1000);
    const after = await service.addXP(user, guild, 'command');
    expect(after.onCooldown).toBe(false);
    expect(after.userLevel.total_xp).toBe(COMMAND_XP * 2);
  });

  it('does not enforce the cooldown across different users', async () => {
    const guild = guildId();
    const firstUser = `user-${randomUUID()}`;
    const secondUser = `user-${randomUUID()}`;
    const now = 1_800_000_000_000;
    at(now);
    await service.addXP(firstUser, guild, 'command');
    at(now + 1000);
    const result = await service.addXP(secondUser, guild, 'command');
    expect(result.onCooldown).toBe(false);
  });

  it('grants a burst of concurrent calls exactly once, even within one millisecond', async () => {
    const guild = guildId();
    const user = `user-${randomUUID()}`;
    at(1_800_000_000_000);
    const results = await Promise.all(
      Array.from({ length: 5 }, () => service.addXP(user, guild, 'command')),
    );
    expect(results.filter((result) => !result.onCooldown)).toHaveLength(1);
  });
});

describe('recordGameResult', () => {
  const service = new GamificationService();

  it('awards XP once even when the same result is recorded twice at once', async () => {
    const guild = `guild-${randomUUID()}`;
    const input = {
      sessionId: randomUUID(),
      guildId: guild,
      gameType: 'tic-tac-toe',
      results: [
        { userId: 'winner', position: 1 },
        { userId: 'loser', position: 2 },
      ],
    };

    await Promise.allSettled([
      service.recordGameResult(input),
      service.recordGameResult(input),
    ]);

    const stats = await service.getUserGameStats('winner', guild);
    expect(stats.stats.total_games).toBe(1);
    expect(stats.stats.games_won).toBe(1);
  });

  it('rejects a reused result id from another guild before granting participant XP', async () => {
    const sessionId = randomUUID();
    await service.recordGameResult({
      sessionId,
      guildId: `guild-${randomUUID()}`,
      gameType: 'tic-tac-toe',
      results: [{ userId: 'original-player', position: 1 }],
    });

    const otherGuild = `guild-${randomUUID()}`;
    await expect(
      service.recordGameResult({
        sessionId,
        guildId: otherGuild,
        gameType: 'tic-tac-toe',
        results: [{ userId: 'collision-player', position: 1 }],
      }),
    ).rejects.toThrow('Game result ID collision with different game data');

    const stats = await service.getUserGameStats(
      'collision-player',
      otherGuild,
    );
    expect(stats.stats.total_games).toBe(0);
    const [level] = await db
      .select()
      .from(userLevels)
      .where(
        and(
          eq(userLevels.user_id, 'collision-player'),
          eq(userLevels.guild_id, otherGuild),
        ),
      );
    expect(level?.total_xp ?? 0).toBe(0);
  });
});
