import { db } from '@marquinhos/database/client';
import {
  achievements,
  userAchievements,
  userLevels,
  wordleDays,
  wordleSessions,
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

const service = new WordleAchievementService();
const defaults = new AchievementService(new LevelingService());
const identity = () => ({ userId: randomUUID(), guildId: randomUUID() });

async function day(
  userId: string,
  guildId: string,
  options: {
    date?: string;
    attempts?: number;
    solved?: boolean;
    startedAt?: number;
    solvedAt?: number | null;
    id?: string;
    guesses?: string;
  } = {},
) {
  const wordDate = options.date ?? '2026-01-01';
  await db
    .insert(wordleDays)
    .values({
      guild_id: guildId,
      word_date: wordDate,
      word: null,
      word_length: 5,
      is_legacy: true,
      created_at: 0,
    })
    .onConflictDoNothing();
  await db.insert(wordleSessions).values({
    id: options.id ?? randomUUID(),
    user_id: userId,
    guild_id: guildId,
    word_date: wordDate,
    attempts: options.attempts ?? 3,
    solved: options.solved ?? true,
    created_at: options.startedAt ?? 100,
    solved_at: options.solvedAt ?? null,
    guesses: options.guesses ?? '[]',
  });
}

let restoreCatalog: (() => Promise<void>) | undefined;
beforeAll(async () => {
  restoreCatalog = await installWordleAchievementCatalog();
});
afterAll(async () => {
  await restoreCatalog?.();
});

describe('Wordle achievement progression', () => {
  it('loads player history once when awarding and returns the same snapshot statistics', async () => {
    const { userId, guildId } = identity();
    await day(userId, guildId, { attempts: 1 });
    const historyReads = spyOn(service, 'loadHistory');
    try {
      const result = await db.transaction((tx) =>
        service.checkAndAward(userId, guildId, tx),
      );
      expect(historyReads).toHaveBeenCalledTimes(1);
      expect(result).toHaveProperty(
        'stats',
        expect.objectContaining({ played: 1, wins: 1 }),
      );
      expect(result).toHaveProperty('unlockedAchievements', expect.any(Array));
    } finally {
      historyReads.mockRestore();
    }
  });
  it('upgrades the phase-one catalog while preserving non-Wordle definitions', async () => {
    await db
      .update(achievements)
      .set({ name: 'old name', reward_xp: 1 })
      .where(eq(achievements.id, 'wordle_first_win'));
    const customId = randomUUID();
    await db.insert(achievements).values({
      id: customId,
      name: 'custom',
      description: '',
      category: 'custom',
      rarity: 'common',
      icon: '',
      condition: '{}',
      reward_xp: 123,
    });
    try {
      await defaults.initializeDefaults();
      await defaults.initializeDefaults();
      const [wordle] = await db
        .select()
        .from(achievements)
        .where(eq(achievements.id, 'wordle_first_win'));
      expect(wordle).toMatchObject({ name: 'Primeira palavra', reward_xp: 25 });
      const [custom] = await db
        .select()
        .from(achievements)
        .where(eq(achievements.id, customId));
      expect(custom).toMatchObject({ name: 'custom', reward_xp: 123 });
      const catalog = await service.getAchievements('nobody', 'no-guild');
      expect(catalog).toHaveLength(WORDLE_ACHIEVEMENT_CATALOG.length);
    } finally {
      // The preload database is shared by every test file: a leftover generic
      // row would stop initializeDefaults from seeding the generic defaults.
      await db.delete(achievements).where(eq(achievements.id, customId));
    }
  });

  it('returns capped progress and statistics without awarding on reads', async () => {
    const { userId, guildId } = identity();
    await day(userId, guildId, { attempts: 2 });
    await day(userId, guildId, { date: '2026-01-02', solved: false });
    const overview = await service.getOverview(userId, guildId);
    expect(overview.stats).toMatchObject({
      played: 2,
      wins: 1,
      winRate: 50,
      bestStreak: 1,
    });
    expect(overview.stats.distribution).toEqual([0, 1, 0, 0, 0, 0, 0]);
    expect(
      overview.achievements.find((a) => a.id === 'wordle_wins_10')?.progress,
    ).toEqual({ current: 1, target: 10 });
    expect(
      overview.achievements.find((a) => a.id === 'wordle_first_win')
        ?.unlockedAt,
    ).toBeNull();
    const unlocks = await db
      .select()
      .from(userAchievements)
      .where(eq(userAchievements.user_id, userId));
    expect(unlocks).toEqual([]);
  });

  it('masks locked secrets on the wire and reveals them after earning', async () => {
    const { userId, guildId } = identity();
    const secret = WORDLE_ACHIEVEMENT_CATALOG.find(
      (a) => a.hidden && a.rule.kind === 'solved_after',
    );
    if (!secret) throw new Error('Secret persistence definition missing');
    const locked = (await service.getAchievements(userId, guildId)).find(
      (a) => a.id === secret.id,
    );
    expect(locked).toMatchObject({
      name: '',
      description: '',
      icon: '❔',
      hidden: true,
      progress: null,
    });
    await day(userId, guildId, { attempts: 20 });
    await db.transaction((tx) => service.checkAndAward(userId, guildId, tx));
    const revealed = (await service.getAchievements(userId, guildId)).find(
      (a) => a.id === secret.id,
    );
    expect(revealed?.name).toBe(secret.name);
    expect(revealed?.unlockedAt).not.toBeNull();
  });

  it('computes holder percentages only from participating guild members', async () => {
    const { userId, guildId } = identity();
    await day(userId, guildId);
    await day('other-player', guildId, { solved: false });
    await day('empty-player', guildId, { attempts: 0, solved: false });
    await day('outside-player', 'other-guild');
    await db.transaction((tx) => service.checkAndAward(userId, guildId, tx));
    const catalog = await service.getAchievements(userId, guildId);
    expect(
      catalog.find((a) => a.id === 'wordle_first_win')?.holdersPercent,
    ).toBe(50);
    expect(
      (await service.getAchievements(userId, 'empty-guild')).every(
        (a) => a.holdersPercent === null,
      ),
    ).toBe(true);
  });

  it('never invents legacy timing and resolves first solver ties consistently', async () => {
    const { userId, guildId } = identity();
    await day(userId, guildId, { id: 'b', solvedAt: 150 });
    await day('first-player', guildId, { id: 'a', solvedAt: 150 });
    await day(userId, guildId, { date: '2026-01-02' });
    const history = await service.loadHistory(userId, guildId);
    expect(history.days[0]).toMatchObject({
      firstSolverInGuild: false,
      solvedAt: 150,
    });
    expect(history.days[1]).toMatchObject({
      firstSolverInGuild: false,
      solvedAt: null,
    });
    expect(
      (await service.loadHistory('first-player', guildId)).days[0]
        ?.firstSolverInGuild,
    ).toBe(true);
  });

  it('backfills in batches and never grants XP twice on a retry', async () => {
    const { userId, guildId } = identity();
    await day(userId, guildId, { attempts: 1 });
    const first = await service.backfill({ guildId, batchSize: 1 });
    expect(first.playersProcessed).toBe(1);
    expect(first.achievementsAwarded).toBeGreaterThan(0);
    const [level] = await db
      .select()
      .from(userLevels)
      .where(
        and(eq(userLevels.user_id, userId), eq(userLevels.guild_id, guildId)),
      );
    const second = await service.backfill({ guildId, batchSize: 1 });
    expect(second).toMatchObject({
      playersProcessed: 1,
      achievementsAwarded: 0,
    });
    const [after] = await db
      .select()
      .from(userLevels)
      .where(
        and(eq(userLevels.user_id, userId), eq(userLevels.guild_id, guildId)),
      );
    expect(after?.total_xp).toBe(level?.total_xp);
  });

  it('stores the solve time once and returns refreshed statistics with the guess', async () => {
    const { userId, guildId } = identity();
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
    const wordle = new WordleService();
    const wrong = await wordle.submitGuess(userId, guildId, 'gatos');
    if ('error' in wrong) throw new Error(wrong.error);
    expect(wrong.stats).toMatchObject({ played: 1, wins: 0 });
    expect(
      wrong.achievementProgress?.find((row) => row.id === 'wordle_played_10')
        ?.progress,
    ).toEqual({ current: 1, target: 10 });
    const [pending] = await db
      .select()
      .from(wordleSessions)
      .where(eq(wordleSessions.guild_id, guildId));
    expect(pending?.solved_at).toBeNull();
    const result = await wordle.submitGuess(userId, guildId, 'termo');
    if ('error' in result) throw new Error(result.error);
    expect(result.stats).toMatchObject({ played: 1, wins: 1, winRate: 100 });
    expect(
      result.achievementProgress?.find((row) => row.id === 'wordle_wins_10')
        ?.progress,
    ).toEqual({ current: 1, target: 10 });
    const lockedSecrets = WORDLE_ACHIEVEMENT_CATALOG.filter(
      (row) =>
        row.hidden &&
        !result.unlockedAchievements?.some(
          (unlocked) => unlocked.id === row.id,
        ),
    );
    expect(
      result.achievementProgress
        ?.filter((row) => lockedSecrets.some((secret) => secret.id === row.id))
        .every((row) => row.progress === null),
    ).toBe(true);
    const [solved] = await db
      .select()
      .from(wordleSessions)
      .where(eq(wordleSessions.guild_id, guildId));
    expect(solved?.solved_at).toBeGreaterThanOrEqual(solved?.created_at ?? 0);
    await wordle.submitGuess(userId, guildId, 'termo');
    const [retried] = await db
      .select()
      .from(wordleSessions)
      .where(eq(wordleSessions.guild_id, guildId));
    expect(retried?.solved_at).toBe(solved?.solved_at);
  });

  it('keeps the first solver stable when later solves share the same second', async () => {
    const { guildId } = identity();
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
    await day('early-player', guildId, {
      date: today,
      id: `${guildId}-z`,
      attempts: 0,
      solved: false,
    });
    await day('late-player', guildId, {
      date: today,
      id: `${guildId}-a`,
      attempts: 0,
      solved: false,
    });
    const now = spyOn(Date, 'now').mockReturnValue(Date.now());
    try {
      const wordle = new WordleService();
      await wordle.submitGuess('early-player', guildId, 'termo');
      await wordle.submitGuess('late-player', guildId, 'termo');
    } finally {
      now.mockRestore();
    }
    expect(
      (await service.loadHistory('early-player', guildId)).days[0]
        ?.firstSolverInGuild,
    ).toBe(true);
    expect(
      (await service.loadHistory('late-player', guildId)).days[0]
        ?.firstSolverInGuild,
    ).toBe(false);
    const holders = await db
      .select()
      .from(userAchievements)
      .where(
        and(
          eq(userAchievements.guild_id, guildId),
          eq(userAchievements.achievement_id, 'wordle_first_solver_1'),
        ),
      );
    expect(holders.map((row) => row.user_id)).toEqual(['early-player']);
  });
});
