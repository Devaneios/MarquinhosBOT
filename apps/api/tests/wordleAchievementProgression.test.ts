import { db } from '@marquinhos/database/client';
import {
  userAchievements,
  wordleDays,
  wordlePatternDiscoveries,
  wordleSessions,
} from '@marquinhos/database/schema';
import { WORDLE_ACHIEVEMENT_CATALOG } from '@marquinhos/domain/games/wordle/achievements/catalog';
import { matchWordlePatterns } from '@marquinhos/domain/games/wordle/achievements/matchPatterns';
import { WORDLE_PATTERN_CATALOG } from '@marquinhos/domain/games/wordle/achievements/patterns';
import { afterAll, beforeAll, describe, expect, it, spyOn } from 'bun:test';
import { and, eq } from 'drizzle-orm';
import { WordleAchievementService } from 'services/wordle/WordleAchievementService';
import {
  achievementId,
  achievementXp,
  earnedAchievements,
  identity,
  installWordleAchievementCatalog,
  seedAchievementDay,
} from './helpers/wordleAchievementCatalog';

const service = new WordleAchievementService();
const award = (userId: string, guildId: string) =>
  db.transaction((tx) => service.checkAndAward(userId, guildId, tx));
let restoreCatalog: (() => Promise<void>) | undefined;
beforeAll(async () => {
  restoreCatalog = await installWordleAchievementCatalog();
});
afterAll(async () => {
  await restoreCatalog?.();
});

function guesses(mask: string[], color: 'correct' | 'present' = 'correct') {
  return JSON.stringify(
    mask.map((row) => ({
      guess: 'abcde',
      feedback: [...row.padEnd(5, '.')].map((cell) =>
        cell === '#' ? color : 'absent',
      ),
    })),
  );
}

function discoveryRows(userId: string, guildId: string) {
  return db
    .select()
    .from(wordlePatternDiscoveries)
    .where(
      and(
        eq(wordlePatternDiscoveries.user_id, userId),
        eq(wordlePatternDiscoveries.guild_id, guildId),
      ),
    );
}

describe('Wordle discovery reconciliation', () => {
  it('loads history once for rewards and returns read-only progress with lifetime statistics', async () => {
    const { userId, guildId } = identity();
    await seedAchievementDay(userId, guildId, { attempts: 2 });
    await seedAchievementDay(userId, guildId, {
      date: '2026-01-02',
      solved: false,
    });
    const overview = await service.getOverview(userId, guildId);
    expect(overview.stats).toMatchObject({
      played: 2,
      wins: 1,
      winRate: 50,
      bestStreak: 1,
    });
    expect(overview.stats.distribution).toEqual([0, 1, 0, 0, 0, 0, 0]);
    const wins10 = achievementId(
      (rule) => rule.kind === 'wins' && rule.count === 10,
    );
    expect(
      overview.achievements.find((row) => row.id === wins10)?.progress,
    ).toEqual({ current: 1, target: 10 });
    expect(await earnedAchievements(userId, guildId)).toEqual([]);
    expect(await discoveryRows(userId, guildId)).toEqual([]);
    const reads = spyOn(service, 'loadHistory');
    try {
      const result = await award(userId, guildId);
      expect(reads).toHaveBeenCalledTimes(1);
      expect(result.stats).toEqual(overview.stats);
    } finally {
      reads.mockRestore();
    }
  });

  it('keeps locked secret metadata concealed and reveals only earned conditions', async () => {
    const { userId, guildId } = identity();
    const secret = WORDLE_ACHIEVEMENT_CATALOG.find(
      (row) => row.hidden && row.rule.kind === 'slow_solve',
    );
    if (!secret) throw new Error('Secret definition missing');
    const status = (await service.getAchievements(userId, guildId)).find(
      (row) => row.id === secret.id,
    );
    expect(status).toMatchObject({
      name: '',
      description: '',
      icon: '❔',
      hidden: true,
      progress: null,
    });
    await seedAchievementDay(userId, guildId, {
      attempts: 3,
      startedAt: 100,
      solvedAt: 3700,
    });
    await award(userId, guildId);
    const revealed = (await service.getAchievements(userId, guildId)).find(
      (row) => row.id === secret.id,
    );
    expect(revealed?.name).toBe(secret.name);
    expect(revealed?.unlockedAt).not.toBeNull();
  });

  it('uses only active-version participants for holder percentages', async () => {
    const { userId, guildId } = identity();
    await seedAchievementDay(userId, guildId);
    await seedAchievementDay('other-player', guildId, { solved: false });
    await seedAchievementDay('old-player', guildId, { version: 1 });
    await seedAchievementDay('empty-player', guildId, {
      attempts: 0,
      solved: false,
    });
    await award(userId, guildId);
    const id = achievementId(
      (rule) => rule.kind === 'wins' && rule.count === 1,
    );
    expect(
      (await service.getAchievements(userId, guildId)).find(
        (row) => row.id === id,
      )?.holdersPercent,
    ).toBe(50);
    expect(
      (await service.getAchievements(userId, 'empty-guild')).every(
        (row) => row.holdersPercent === null,
      ),
    ).toBe(true);
  });

  it('persists first yellow evidence once across colors, later dates and backfill retries', async () => {
    const { userId, guildId } = identity();
    await seedAchievementDay(userId, guildId, {
      attempts: 1,
      solved: false,
      guesses: guesses(['#####'], 'present'),
    });
    const first = await award(userId, guildId);
    const id = achievementId(
      (rule) => rule.kind === 'pattern' && rule.patternId === 'tetromino_i',
    );
    const badge = first.unlockedAchievements.find((row) => row.id === id);
    expect(badge?.patternPreview?.patternId).toBe('tetromino_i');
    expect(badge?.matchEvidence).toMatchObject({
      color: 'present',
      date: '2026-01-01',
    });
    const before = await discoveryRows(userId, guildId);
    const xp = await achievementXp(userId, guildId);
    await seedAchievementDay(userId, guildId, {
      date: '2026-01-02',
      attempts: 1,
      solved: false,
      guesses: guesses(['#####']),
    });
    await service.backfill({ guildId, batchSize: 1 });
    expect(await discoveryRows(userId, guildId)).toEqual(before);
    const after = await service.backfill({ guildId, batchSize: 1 });
    expect(after).toEqual({ playersProcessed: 1, achievementsAwarded: 0 });
    expect(await achievementXp(userId, guildId)).toBe(xp);
    expect(
      (await service.getAchievements(userId, guildId)).find(
        (row) => row.id === id,
      )?.matchEvidence,
    ).toEqual(badge?.matchEvidence);
  });

  it('rejects a corrupt matrix as a whole without joining valid rows into a drawing', async () => {
    const { userId, guildId } = identity();
    const malformed = JSON.stringify([
      {
        guess: 'abcde',
        feedback: ['correct', 'correct', 'absent', 'absent', 'absent'],
      },
      {
        guess: 'abcde',
        feedback: ['correct', 'invalid', 'absent', 'absent', 'absent'],
      },
      {
        guess: 'abcde',
        feedback: ['correct', 'correct', 'absent', 'absent', 'absent'],
      },
    ]);
    await seedAchievementDay(userId, guildId, {
      attempts: 3,
      guesses: malformed,
    });
    const result = await award(userId, guildId);
    expect(result.unlockedAchievements.map((row) => row.id)).toContain(
      achievementId((rule) => rule.kind === 'wins' && rule.count === 1),
    );
    expect(await discoveryRows(userId, guildId)).toEqual([]);
    expect(
      (await service.loadHistory(userId, guildId)).days[0]?.feedback,
    ).toBeNull();
  });

  it('retains evidence snapshots when saved gameplay is later changed', async () => {
    const { userId, guildId } = identity();
    await seedAchievementDay(userId, guildId, {
      attempts: 1,
      guesses: guesses(['#####']),
    });
    await award(userId, guildId);
    const before = await discoveryRows(userId, guildId);
    await db
      .update(wordleSessions)
      .set({ guesses: '[]', attempts: 10 })
      .where(eq(wordleSessions.user_id, userId));
    await award(userId, guildId);
    expect(await discoveryRows(userId, guildId)).toEqual(before);
  });

  it('rolls back discoveries together with unlocks and XP', async () => {
    const { userId, guildId } = identity();
    await seedAchievementDay(userId, guildId, {
      attempts: 1,
      guesses: guesses(['#####']),
    });
    await expect(
      db.transaction(async (tx) => {
        await service.checkAndAward(userId, guildId, tx);
        throw new Error('rollback discoveries');
      }),
    ).rejects.toThrow('rollback discoveries');
    expect(await discoveryRows(userId, guildId)).toEqual([]);
    expect(await earnedAchievements(userId, guildId)).toEqual([]);
    expect(await achievementXp(userId, guildId)).toBe(0);
  });

  it('combines concurrent final tetromino discoveries before evaluating the collection', async () => {
    const { userId, guildId } = identity();
    const remaining = new Set(['tetromino_s', 'tetromino_z']);
    for (const pattern of WORDLE_PATTERN_CATALOG.filter(
      (row) => row.family === 'tetromino' && !remaining.has(row.id),
    )) {
      const feedback = pattern.mask.map((row) =>
        [...row.padEnd(5, '.')].map((cell) =>
          cell === '#' ? ('correct' as const) : ('absent' as const),
        ),
      );
      const match = matchWordlePatterns(feedback, [pattern])[0]!;
      await db.insert(wordlePatternDiscoveries).values({
        user_id: userId,
        guild_id: guildId,
        version: 2,
        pattern_id: pattern.id,
        session_id: 'earlier-session',
        discovered_at: 1,
        evidence: { ...match, feedback, date: '2025-12-01' },
      });
    }
    let release!: () => void, firstDone!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const firstReady = new Promise<void>((resolve) => {
      firstDone = resolve;
    });
    const reads = spyOn(service, 'loadHistory');
    for (const date of ['2026-01-01', '2026-01-02']) {
      await db.insert(wordleDays).values({
        guild_id: guildId,
        word_date: date,
        word: null,
        word_length: 5,
        is_legacy: true,
        created_at: 0,
      });
    }
    const first = db.transaction(async (tx) => {
      await tx.insert(wordleSessions).values({
        id: `${guildId}-s`,
        user_id: userId,
        guild_id: guildId,
        word_date: '2026-01-01',
        attempts: 2,
        solved: false,
        guesses: guesses(['.##', '##.']),
        achievement_version: 2,
        created_at: 1,
      });
      const result = await service.checkAndAward(userId, guildId, tx);
      firstDone();
      await gate;
      return result;
    });
    await firstReady;
    const second = db.transaction(async (tx) => {
      await tx.insert(wordleSessions).values({
        id: `${guildId}-z`,
        user_id: userId,
        guild_id: guildId,
        word_date: '2026-01-02',
        attempts: 2,
        solved: false,
        guesses: guesses(['##.', '.##']),
        achievement_version: 2,
        created_at: 1,
      });
      return service.checkAndAward(userId, guildId, tx);
    });
    try {
      await new Promise((resolve) => setTimeout(resolve, 30));
      expect(reads).toHaveBeenCalledTimes(1);
    } finally {
      release();
      reads.mockRestore();
    }
    const results = await Promise.all([first, second]);
    const collectionId = achievementId(
      (rule) =>
        rule.kind === 'pattern_collection' && rule.family === 'tetromino',
    );
    expect(results[0].unlockedAchievements.map((row) => row.id)).not.toContain(
      collectionId,
    );
    expect(results[1].unlockedAchievements.map((row) => row.id)).toContain(
      collectionId,
    );
    const collection = await db
      .select()
      .from(userAchievements)
      .where(
        and(
          eq(userAchievements.user_id, userId),
          eq(userAchievements.guild_id, guildId),
          eq(userAchievements.achievement_id, collectionId),
        ),
      );
    expect(collection).toHaveLength(1);
    expect(
      (await discoveryRows(userId, guildId)).filter((row) =>
        row.pattern_id.startsWith('tetromino_'),
      ),
    ).toHaveLength(7);
    expect((await award(userId, guildId)).unlockedAchievements).toEqual([]);
  });

  it('never invents missing solve timing and resolves guild first-solver ties across versions', async () => {
    const { userId, guildId } = identity();
    await seedAchievementDay(userId, guildId, {
      id: `${guildId}-b`,
      solvedAt: 150,
    });
    await seedAchievementDay('first-player', guildId, {
      id: `${guildId}-a`,
      solvedAt: 150,
      version: 1,
    });
    await seedAchievementDay(userId, guildId, { date: '2026-01-02' });
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
});
