import { db } from '@marquinhos/database/client';
import {
  achievements,
  wordleDays,
  wordleSessions,
  wordleStreaks,
} from '@marquinhos/database/schema';
import { WORDLE_ACHIEVEMENT_CATALOG } from '@marquinhos/domain/games/wordle/achievements/catalog';
import { afterAll, beforeAll, describe, expect, it, spyOn } from 'bun:test';
import { and, eq } from 'drizzle-orm';
import { AchievementService } from 'services/gamification/AchievementService';
import { LevelingService } from 'services/gamification/LevelingService';
import { WordleService } from 'services/wordle';
import { WordleAchievementService } from 'services/wordle/WordleAchievementService';
import { getRecifeDate } from 'services/wordle/wordleDate';
import {
  achievementXp,
  dateAt,
  earnedAchievements,
  identity,
  installWordleAchievementCatalog,
  seedAchievementDay,
  seedAchievementDays,
} from './helpers/wordleAchievementCatalog';

const awards = new WordleAchievementService();
const defaults = new AchievementService(new LevelingService());
const award = (userId: string, guildId: string) =>
  db.transaction((tx) => awards.checkAndAward(userId, guildId, tx));
let restoreCatalog: (() => Promise<void>) | undefined;
beforeAll(async () => {
  restoreCatalog = await installWordleAchievementCatalog();
});
afterAll(async () => {
  await restoreCatalog?.();
});

describe('daily Wordle achievements', () => {
  it('seeds the current catalog and preserves operator-owned generic defaults', async () => {
    const definition = WORDLE_ACHIEVEMENT_CATALOG[0]!;
    await db
      .update(achievements)
      .set({ name: 'customized' })
      .where(eq(achievements.id, definition.id));
    const [removed] = await db
      .delete(achievements)
      .where(eq(achievements.id, 'first_command'))
      .returning();
    try {
      await defaults.initializeDefaults();
      expect(
        (
          await db
            .select()
            .from(achievements)
            .where(eq(achievements.id, definition.id))
        )[0]?.name,
      ).toBe(definition.name);
      expect(
        await db
          .select()
          .from(achievements)
          .where(eq(achievements.id, 'first_command')),
      ).toEqual([]);
    } finally {
      if (removed) await db.insert(achievements).values(removed);
    }
  });

  it('keeps generic archived entries hidden and blocks their rewards', async () => {
    const { userId, guildId } = identity();
    await db
      .update(achievements)
      .set({ archived_at: Date.now() })
      .where(eq(achievements.id, 'commands_10'));
    try {
      expect(
        (await defaults.getAllAchievements()).some(
          (row) => row.id === 'commands_10',
        ),
      ).toBe(false);
      expect(
        await defaults.unlockAchievement(userId, guildId, 'commands_10'),
      ).toBe(false);
      expect(await achievementXp(userId, guildId)).toBe(0);
    } finally {
      await db
        .update(achievements)
        .set({ archived_at: null })
        .where(eq(achievements.id, 'commands_10'));
    }
  });

  it('awards exact first-guess solves once and returns a full ISO-dated collection snapshot', async () => {
    const { userId, guildId } = identity();
    await seedAchievementDay(userId, guildId, { attempts: 1 });
    const result = await award(userId, guildId);
    expect(result.overview.achievements).toHaveLength(
      WORDLE_ACHIEVEMENT_CATALOG.length,
    );
    expect(result.unlockedIds).toContain('wordle_v2_wins_1');
    expect(result.unlockedIds).toContain('wordle_v2_solved_exactly_1');
    expect(result.unlockedIds).not.toContain('wordle_v2_solved_exactly_2');
    const xp = result.overview.achievements
      .filter((badge) => result.unlockedIds.includes(badge.id))
      .reduce((sum, badge) => sum + badge.rewardXp, 0);
    for (const id of result.unlockedIds) {
      const badge = result.overview.achievements.find((row) => row.id === id);
      if (!badge?.unlockedAt) throw new Error(`Missing unlock time for ${id}`);
      expect(new Date(badge.unlockedAt).toISOString()).toBe(badge.unlockedAt);
    }
    expect((await award(userId, guildId)).unlockedIds).toEqual([]);
    expect(await achievementXp(userId, guildId)).toBe(xp);
  });

  it('evaluates wins and efficient solves from eligible counters without requiring matrix evidence', async () => {
    const { userId, guildId } = identity();
    await seedAchievementDays(userId, guildId, 9);
    const wins10 = 'wordle_v2_wins_10';
    expect((await award(userId, guildId)).unlockedIds).not.toContain(wins10);
    await seedAchievementDay(userId, guildId, { date: dateAt(10) });
    const ids = (await award(userId, guildId)).unlockedIds;
    expect(ids).toContain(wins10);
    expect(ids).toContain('wordle_v2_wins_within_3_10');
  });

  it('counts accepted unsolved dates and ignores empty sessions', async () => {
    const { userId, guildId } = identity();
    await seedAchievementDays(userId, guildId, 7, false, 1);
    const ids = (await award(userId, guildId)).unlockedIds;
    expect(ids).toContain('wordle_v2_played_7');
    expect(ids).not.toContain('wordle_v2_wins_1');
    const empty = identity();
    await seedAchievementDay(empty.userId, empty.guildId, {
      attempts: 0,
      solved: false,
    });
    expect((await award(empty.userId, empty.guildId)).unlockedIds).toEqual([]);
  });

  it('does not bridge unsolved days or use the lifetime best for v2 streak rewards', async () => {
    const { userId, guildId } = identity();
    await seedAchievementDays(userId, guildId, 4);
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
    await db.insert(wordleStreaks).values({
      user_id: userId,
      guild_id: guildId,
      current_streak: 0,
      max_streak: 100,
    });
    const result = await award(userId, guildId);
    expect(result.overview.stats.bestStreak).toBe(100);
    expect(result.unlockedIds).not.toContain('wordle_v2_streak_3');
  });

  it('isolates history, discoveries and unlocks across players and guilds', async () => {
    const { userId, guildId } = identity();
    await seedAchievementDay(userId, guildId, { attempts: 1 });
    await award(userId, guildId);
    for (const [user, guild] of [
      [userId, 'elsewhere'],
      ['other', guildId],
    ]) {
      expect((await award(user!, guild!)).unlockedIds).toEqual([]);
      expect(
        (await awards.getOverview(user!, guild!)).achievements.every(
          (row) => row.unlockedAt === null,
        ),
      ).toBe(true);
    }
  });

  it('serializes concurrent evaluations and grants each reward once', async () => {
    const { userId, guildId } = identity();
    await seedAchievementDay(userId, guildId, { attempts: 1 });
    const results = await Promise.all(
      Array.from({ length: 3 }, () => award(userId, guildId)),
    );
    const unlocks = results.flatMap((result) => result.unlockedIds);
    expect(new Set(unlocks).size).toBe(unlocks.length);
    expect(await earnedAchievements(userId, guildId)).toHaveLength(
      unlocks.length,
    );
    expect(await achievementXp(userId, guildId)).toBe(
      results[0]!.overview.achievements
        .filter((badge) => unlocks.includes(badge.id))
        .reduce((sum, badge) => sum + badge.rewardXp, 0),
    );
  });

  it('rolls back unlocks and XP with the caller transaction', async () => {
    const { userId, guildId } = identity();
    await seedAchievementDay(userId, guildId, { attempts: 1 });
    await expect(
      db.transaction(async (tx) => {
        await awards.checkAndAward(userId, guildId, tx);
        throw new Error('rollback test');
      }),
    ).rejects.toThrow('rollback test');
    expect(await earnedAchievements(userId, guildId)).toEqual([]);
    expect(await achievementXp(userId, guildId)).toBe(0);
  });
});

describe('Wordle guess award integration', () => {
  const service = new WordleService();
  const seedDaily = (guildId: string) =>
    db.insert(wordleDays).values({
      guild_id: guildId,
      word: 'termo',
      word_date: getRecifeDate(),
      word_length: 5,
      created_at: 0,
    });

  it('does not treat an incomplete figure inside the winning row as a pattern', async () => {
    const { userId, guildId } = identity();
    await seedDaily(guildId);
    const result = await service.submitGuess(userId, guildId, 'termo');
    if ('error' in result) throw new Error(result.error);
    expect(result.achievementUpdate?.overview.achievements).toHaveLength(
      WORDLE_ACHIEVEMENT_CATALOG.length,
    );
    const pattern = result.achievementUpdate?.overview.achievements.find(
      (row) =>
        row.patternPreview?.patternId === 'tetromino_i' &&
        row.unlockedAt !== null,
    );
    expect(pattern).toBeUndefined();
    expect(await service.submitGuess(userId, guildId, 'termo')).toHaveProperty(
      'error',
    );
    expect(await achievementXp(userId, guildId)).toBe(
      result.achievementUpdate?.overview.achievements
        .filter((badge) =>
          result.achievementUpdate?.unlockedIds.includes(badge.id),
        )
        .reduce((sum, badge) => sum + badge.rewardXp, 0) ?? 0,
    );
  });

  it('keeps the accepted guess if awarding fails and reconciles XP on the next evaluation', async () => {
    const { userId, guildId } = identity();
    await seedDaily(guildId);
    const failure = spyOn(
      LevelingService.prototype,
      'addXpToUser',
    ).mockRejectedValueOnce(new Error('reward unavailable'));
    let result: Awaited<ReturnType<WordleService['submitGuess']>>;
    try {
      result = await service.submitGuess(userId, guildId, 'termo');
    } finally {
      failure.mockRestore();
    }
    if ('error' in result) throw new Error(result.error);
    expect(result.solved).toBe(true);
    expect(result.achievementUpdate).toBeUndefined();
    expect((await service.getUserSession(userId, guildId))?.solved).toBe(true);
    expect(await earnedAchievements(userId, guildId)).toEqual([]);
    expect(await achievementXp(userId, guildId)).toBe(0);
    expect((await award(userId, guildId)).unlockedIds.length).toBeGreaterThan(
      0,
    );
  });

  it('derives first solver from all sessions even when day counters drift', async () => {
    const { userId, guildId } = identity();
    await seedDaily(guildId);
    await db
      .update(wordleDays)
      .set({ winners_count: 3 })
      .where(eq(wordleDays.guild_id, guildId));
    const second = identity().userId;
    await service.submitGuess(userId, guildId, 'termo');
    await service.submitGuess(second, guildId, 'termo');
    const sessions = await db
      .select()
      .from(wordleSessions)
      .where(eq(wordleSessions.guild_id, guildId));
    expect(sessions.find((row) => row.user_id === userId)?.first_solver).toBe(
      true,
    );
    expect(sessions.find((row) => row.user_id === second)?.first_solver).toBe(
      false,
    );
  });
});
