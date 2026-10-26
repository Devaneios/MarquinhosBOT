import { db } from '@marquinhos/database/client';
import {
  achievements,
  userAchievements,
  userLevels,
  wordleDays,
  wordleSessions,
  wordleStreaks,
} from '@marquinhos/database/schema';
import { WORDLE_ACHIEVEMENT_CATALOG } from '@marquinhos/domain/games/wordle/achievements/catalog';
import { afterAll, beforeAll, describe, expect, it, spyOn } from 'bun:test';
import { randomUUID } from 'crypto';
import { and, eq } from 'drizzle-orm';
import { AchievementService } from 'services/gamification/AchievementService';
import { LevelingService } from 'services/gamification/LevelingService';
import { WordleService } from 'services/wordle';
import { WordleAchievementService } from 'services/wordle/WordleAchievementService';
import { installWordleAchievementCatalog } from './helpers/wordleAchievementCatalog';

const awards = new WordleAchievementService();
const defaults = new AchievementService(new LevelingService());
async function award(
  ...args: Parameters<WordleAchievementService['checkAndAward']>
) {
  return (await awards.checkAndAward(...args)).unlockedAchievements;
}
const identity = () => ({ userId: randomUUID(), guildId: randomUUID() });

function dateAt(day: number): string {
  return new Date(Date.UTC(2025, 0, day)).toISOString().slice(0, 10);
}

async function seedDays(
  userId: string,
  guildId: string,
  days: number,
  solved: boolean,
  attempts = 3,
) {
  const sessions = Array.from({ length: days }, (_, index) => ({
    id: randomUUID(),
    user_id: userId,
    guild_id: guildId,
    word_date: dateAt(index + 1),
    guesses: '[]',
    solved,
    attempts,
    created_at: 0,
  }));
  await db
    .insert(wordleDays)
    .values(
      sessions.map(({ guild_id, word_date }) => ({
        guild_id,
        word_date,
        word: null,
        word_length: 5,
        is_legacy: true,
        created_at: 0,
      })),
    )
    .onConflictDoNothing();
  await db.insert(wordleSessions).values(sessions);
}

async function earned(userId: string, guildId: string) {
  return db
    .select()
    .from(userAchievements)
    .where(
      and(
        eq(userAchievements.user_id, userId),
        eq(userAchievements.guild_id, guildId),
      ),
    );
}

async function xp(userId: string, guildId: string) {
  const [row] = await db
    .select()
    .from(userLevels)
    .where(
      and(eq(userLevels.user_id, userId), eq(userLevels.guild_id, guildId)),
    );
  return row?.total_xp ?? 0;
}

let restoreCatalog: (() => Promise<void>) | undefined;
beforeAll(async () => {
  restoreCatalog = await installWordleAchievementCatalog();
});
afterAll(async () => {
  await restoreCatalog?.();
});

describe('daily Wordle achievements', () => {
  it('tops up defaults and upgrades canonical Wordle definitions', async () => {
    await db
      .update(achievements)
      .set({ name: 'Nome personalizado' })
      .where(eq(achievements.id, 'wordle_wins_50'));
    await db
      .delete(achievements)
      .where(eq(achievements.id, 'wordle_played_10'));
    try {
      await defaults.initializeDefaults();
      const catalog = await awards.getAchievements('fresh', 'fresh');
      expect(catalog).toHaveLength(WORDLE_ACHIEVEMENT_CATALOG.length);
      expect(catalog.find((a) => a.id === 'wordle_wins_50')?.name).toBe(
        'Cinquenta palavras',
      );
      expect(catalog.every((a) => a.unlockedAt === null)).toBe(true);
      expect(await xp('fresh', 'fresh')).toBe(0);
    } finally {
      await db
        .update(achievements)
        .set({ name: 'Cinquenta palavras' })
        .where(eq(achievements.id, 'wordle_wins_50'));
    }
  });

  it('awards historical first-guess solves once, with ISO timestamps and XP', async () => {
    const { userId, guildId } = identity();
    await seedDays(userId, guildId, 1, true, 1);
    const unlocked = await db.transaction((tx) => award(userId, guildId, tx));
    expect(unlocked.map((a) => a.id).sort()).toEqual([
      'wordle_first_win',
      'wordle_solved_in_1',
      'wordle_solved_in_2',
    ]);
    for (const badge of unlocked) {
      expect(new Date(badge.unlockedAt).toISOString()).toBe(badge.unlockedAt);
    }
    expect(await xp(userId, guildId)).toBe(175);
    expect(await db.transaction((tx) => award(userId, guildId, tx))).toEqual(
      [],
    );
    expect(await xp(userId, guildId)).toBe(175);
    const collection = await awards.getAchievements(userId, guildId);
    expect(collection.filter((a) => a.unlockedAt !== null)).toHaveLength(3);
  });

  it('uses solved-day thresholds without awarding efficiency for unsolved sessions', async () => {
    const { userId, guildId } = identity();
    await seedDays(userId, guildId, 9, true);
    const before = await db.transaction((tx) => award(userId, guildId, tx));
    expect(before.some((a) => a.id === 'wordle_wins_10')).toBe(false);
    await db.insert(wordleDays).values({
      guild_id: guildId,
      word_date: dateAt(10),
      word: null,
      word_length: 5,
      is_legacy: true,
      created_at: 0,
    });
    await db.insert(wordleSessions).values({
      id: randomUUID(),
      user_id: userId,
      guild_id: guildId,
      word_date: dateAt(10),
      solved: true,
      attempts: 3,
      created_at: 0,
    });
    const after = await db.transaction((tx) => award(userId, guildId, tx));
    expect(after.map((a) => a.id).sort()).toEqual([
      'wordle_played_10',
      'wordle_wins_10',
      'wordle_wins_within_3_10',
    ]);
    expect(
      (await earned(userId, guildId)).some((a) =>
        a.achievement_id.startsWith('wordle_solved_in_'),
      ),
    ).toBe(false);
  });

  it('counts unsolved participation while ignoring empty sessions', async () => {
    const { userId, guildId } = identity();
    await seedDays(userId, guildId, 10, false, 1);
    const unlocked = await db.transaction((tx) => award(userId, guildId, tx));
    expect(unlocked.map((a) => a.id)).toEqual(['wordle_played_10']);
    const empty = identity();
    await seedDays(empty.userId, empty.guildId, 10, false, 0);
    expect(
      await db.transaction((tx) => award(empty.userId, empty.guildId, tx)),
    ).toEqual([]);
  });

  it('awards fifty wins only at the fiftieth solved day', async () => {
    const { userId, guildId } = identity();
    await seedDays(userId, guildId, 49, true);
    const before = await db.transaction((tx) => award(userId, guildId, tx));
    expect(before.some((a) => a.id === 'wordle_wins_50')).toBe(false);
    await db.insert(wordleDays).values({
      guild_id: guildId,
      word_date: dateAt(50),
      word: null,
      word_length: 5,
      is_legacy: true,
      created_at: 0,
    });
    await db.insert(wordleSessions).values({
      id: randomUUID(),
      user_id: userId,
      guild_id: guildId,
      word_date: dateAt(50),
      solved: true,
      attempts: 3,
      created_at: 0,
    });
    const after = await db.transaction((tx) => award(userId, guildId, tx));
    expect(after.map((a) => a.id)).toEqual([
      'wordle_wins_50',
      'wordle_wins_within_3_50',
    ]);
  });

  it('does not bridge unsolved days when reconstructing a streak', async () => {
    const { userId, guildId } = identity();
    await seedDays(userId, guildId, 4, true, 2);
    await db
      .update(wordleSessions)
      .set({ solved: false })
      .where(
        and(
          eq(wordleSessions.user_id, userId),
          eq(wordleSessions.guild_id, guildId),
          eq(wordleSessions.word_date, dateAt(3)),
        ),
      );
    const unlocked = await db.transaction((tx) => award(userId, guildId, tx));
    expect(unlocked.map((a) => a.id)).toEqual([
      'wordle_first_win',
      'wordle_solved_in_2',
    ]);
  });

  it('reconstructs best streak from history and respects a preserved best streak', async () => {
    const { userId, guildId } = identity();
    await seedDays(userId, guildId, 7, true);
    const unlocked = await db.transaction((tx) => award(userId, guildId, tx));
    expect(unlocked.map((a) => a.id)).toContain('wordle_streak_7');
    expect(unlocked.map((a) => a.id)).not.toContain('wordle_streak_30');
    await db.insert(wordleStreaks).values({
      user_id: userId,
      guild_id: guildId,
      current_streak: 0,
      max_streak: 30,
    });
    expect(
      (await db.transaction((tx) => award(userId, guildId, tx))).map(
        (a) => a.id,
      ),
    ).toEqual(['wordle_streak_14', 'wordle_streak_30']);
  });

  it('does not combine history or unlocks across users and guilds', async () => {
    const { userId, guildId } = identity();
    await seedDays(userId, guildId, 1, true, 1);
    await db.transaction((tx) => award(userId, guildId, tx));
    const others: [string, string][] = [
      [userId, 'other'],
      ['other', guildId],
    ];
    for (const [user, guild] of others) {
      expect(await db.transaction((tx) => award(user, guild, tx))).toEqual([]);
      expect(
        (await awards.getAchievements(user, guild)).every(
          (a) => a.unlockedAt === null,
        ),
      ).toBe(true);
    }
  });

  it('awards concurrent evaluations only once', async () => {
    const { userId, guildId } = identity();
    await seedDays(userId, guildId, 1, true, 1);
    const results = await Promise.all(
      Array.from({ length: 3 }, () =>
        db.transaction((tx) => award(userId, guildId, tx)),
      ),
    );
    expect(results.flat()).toHaveLength(3);
    expect(await earned(userId, guildId)).toHaveLength(3);
    expect(await xp(userId, guildId)).toBe(175);
  });

  it('rolls back achievement and XP writes with the caller transaction', async () => {
    const { userId, guildId } = identity();
    await seedDays(userId, guildId, 1, true, 1);
    await expect(
      db.transaction(async (tx) => {
        await award(userId, guildId, tx);
        throw new Error('rollback test');
      }),
    ).rejects.toThrow('rollback test');
    expect(await earned(userId, guildId)).toEqual([]);
    expect(await xp(userId, guildId)).toBe(0);
  });
});

describe('Wordle guess award integration', () => {
  const service = new WordleService();
  async function seedDaily(guildId: string) {
    const today = new Intl.DateTimeFormat('sv-SE', {
      timeZone: process.env.WORDLE_TIMEZONE ?? 'America/Recife',
    }).format(new Date());
    await db.insert(wordleDays).values({
      guild_id: guildId,
      word: 'termo',
      word_date: today,
      word_length: 5,
      is_legacy: false,
      created_at: 0,
    });
  }

  it('returns fresh unlocks with the solved guess and rejects a repeated solve', async () => {
    const { userId, guildId } = identity();
    await seedDaily(guildId);
    const result = await service.submitGuess(userId, guildId, 'termo');
    expect(result).not.toHaveProperty('error');
    if ('error' in result) throw new Error(result.error);
    expect(result.unlockedAchievements?.map((a) => a.id)).toEqual(
      expect.arrayContaining([
        'wordle_first_win',
        'wordle_solved_in_1',
        'wordle_solved_in_2',
      ]),
    );
    expect(await service.submitGuess(userId, guildId, 'termo')).toHaveProperty(
      'error',
    );
    expect(await xp(userId, guildId)).toBe(
      result.unlockedAchievements?.reduce(
        (total, badge) => total + badge.rewardXp,
        0,
      ) ?? 0,
    );
  });

  it('awards the tenth participation day on an unsolved guess', async () => {
    const { userId, guildId } = identity();
    await seedDays(userId, guildId, 9, false, 1);
    await seedDaily(guildId);
    const result = await service.submitGuess(userId, guildId, 'gatos');
    if ('error' in result) throw new Error(result.error);
    expect(result.solved).toBe(false);
    expect(result.unlockedAchievements?.map((a) => a.id)).toEqual([
      'wordle_played_10',
    ]);
  });

  it('rolls back the guess, streak and daily stats when rewarding XP fails', async () => {
    const { userId, guildId } = identity();
    await seedDaily(guildId);
    const failingReward = spyOn(
      LevelingService.prototype,
      'addXpToUser',
    ).mockRejectedValueOnce(new Error('reward unavailable'));
    try {
      await expect(
        service.submitGuess(userId, guildId, 'termo'),
      ).rejects.toThrow('reward unavailable');
    } finally {
      failingReward.mockRestore();
    }
    expect(await service.getUserSession(userId, guildId)).toBeNull();
    expect(await earned(userId, guildId)).toEqual([]);
    expect(await xp(userId, guildId)).toBe(0);
    const [daily] = await db
      .select()
      .from(wordleDays)
      .where(eq(wordleDays.guild_id, guildId));
    expect(daily).toMatchObject({ players_count: 0, winners_count: 0 });
    const streak = await db
      .select()
      .from(wordleStreaks)
      .where(
        and(
          eq(wordleStreaks.user_id, userId),
          eq(wordleStreaks.guild_id, guildId),
        ),
      );
    expect(streak).toEqual([]);
  });
});
