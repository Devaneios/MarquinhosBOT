import { wordlePatternEvidenceSchema } from '@marquinhos/contracts/wordle';
import { db } from '@marquinhos/database/client';
import {
  userAchievements,
  userLevels,
  wordleDays,
  wordlePatternDiscoveries,
  wordleSessions,
} from '@marquinhos/database/schema';
import {
  WORDLE_ACHIEVEMENT_CATALOG,
  WORDLE_DRAWING_CATALOG,
} from '@marquinhos/domain/games/wordle/achievements/catalog';
import { matchWordlePatterns } from '@marquinhos/domain/games/wordle/achievements/engine/matchPatterns';
import { computeFeedback } from '@marquinhos/domain/games/wordle/feedback';
import { stripDiacritics } from '@marquinhos/domain/shared/text/stripDiacritics';
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { and, eq } from 'drizzle-orm';
import { WordleAchievementService } from 'services/wordle/WordleAchievementService';
import {
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

function guessesFor(answer: string, words: readonly string[]) {
  const normalizedAnswer = stripDiacritics(answer);
  return JSON.stringify(
    words.map((word) => {
      const guess = stripDiacritics(word);
      return {
        guess,
        feedback: computeFeedback(guess, normalizedAnswer),
      };
    }),
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
  it('forms DEVANEIOS from accepted same-row feedback, isolates histories, and awards it once', async () => {
    const { userId, guildId } = identity();
    const sequence = [
      { date: '2026-10-25', word: 'desejo' },
      { date: '2026-10-26', word: 'chuva' },
      { date: '2026-10-27', word: 'nenhuma' },
      { date: '2026-10-28', word: 'vitorioso' },
    ];

    for (const { date, word } of sequence) {
      await seedAchievementDay(userId, guildId, {
        date,
        attempts: 1,
        solved: true,
        width: word.length,
        word,
        guesses: guessesFor(word, [word]),
      });
    }

    const overview = await service.getOverview(userId, guildId);
    expect(
      overview.achievements.find(
        (achievement) => achievement.id === 'wordle_v2_devaneios_rows',
      ),
    ).toMatchObject({ unlockedAt: null, progress: { current: 9, target: 9 } });

    const firstAward = await award(userId, guildId);
    expect(firstAward.unlockedIds).toContain('wordle_v2_devaneios_rows');
    const xpAfterFirstAward = await achievementXp(userId, guildId);
    const retry = await award(userId, guildId);
    expect(retry.unlockedIds).not.toContain('wordle_v2_devaneios_rows');
    expect(await achievementXp(userId, guildId)).toBe(xpAfterFirstAward);
    expect(
      (await earnedAchievements(userId, guildId)).filter(
        (achievement) =>
          achievement.achievement_id === 'wordle_v2_devaneios_rows',
      ),
    ).toHaveLength(1);

    const otherPlayer = identity();
    await seedAchievementDay(otherPlayer.userId, guildId, {
      date: '2026-10-26',
      attempts: 1,
      solved: true,
      width: 'chuva'.length,
      word: 'chuva',
      guesses: guessesFor('chuva', ['chuva']),
    });
    const otherPlayerOverview = await service.getOverview(
      otherPlayer.userId,
      guildId,
    );
    expect(
      otherPlayerOverview.achievements.find(
        (achievement) => achievement.id === 'wordle_v2_devaneios_rows',
      )?.progress,
    ).toEqual({ current: 0, target: 9 });

    const otherGuildOverview = await service.getOverview(
      userId,
      identity().guildId,
    );
    expect(
      otherGuildOverview.achievements.find(
        (achievement) => achievement.id === 'wordle_v2_devaneios_rows',
      )?.progress,
    ).toEqual({ current: 0, target: 9 });

    const draftPlayer = identity();
    await seedAchievementDay(draftPlayer.userId, guildId, {
      date: '2026-10-25',
      attempts: 1,
      solved: true,
      width: 'desejo'.length,
      word: 'desejo',
      guesses: guessesFor('desejo', ['desejo']),
    });
    await seedAchievementDay(draftPlayer.userId, guildId, {
      date: '2026-10-26',
      attempts: 0,
      solved: true,
      solvedFromDraft: true,
      width: 'chuva'.length,
      word: 'chuva',
      guesses: '[]',
    });
    const draftOverview = await service.getOverview(
      draftPlayer.userId,
      guildId,
    );
    expect(
      draftOverview.achievements.find(
        (achievement) => achievement.id === 'wordle_v2_devaneios_rows',
      )?.progress,
    ).toEqual({ current: 2, target: 9 });
  });

  it('awards each newly confirmed gameplay goal from production feedback', async () => {
    const cases = [
      {
        answer: 'partes',
        guesses: ['bibico', 'bichon', 'partes'],
        id: 'wordle_v2_blank_twice_then_solved',
      },
      {
        answer: 'partes',
        guesses: ['cartes', 'fartes', 'partes'],
        id: 'wordle_v2_near_miss_twice',
      },
      {
        answer: 'castro',
        guesses: ['torças', 'traços', 'castro'],
        id: 'wordle_v2_yellow_only_before_solve',
      },
      {
        answer: 'castro',
        guesses: ['torças', 'castor', 'castro'],
        id: 'wordle_v2_anagrams_only_before_solve',
      },
      {
        answer: 'partes',
        guesses: ['bibico', 'cartes', 'partes'],
        id: 'wordle_v2_solved_exactly_3',
      },
    ];

    for (const example of cases) {
      const { userId, guildId } = identity();
      await seedAchievementDay(userId, guildId, {
        attempts: example.guesses.length,
        solved: true,
        width: example.answer.length,
        word: example.answer,
        guesses: guessesFor(example.answer, example.guesses),
      });
      expect((await award(userId, guildId)).unlockedIds).toContain(example.id);
    }
  });

  it('returns read-only progress with lifetime statistics before reconciling rewards', async () => {
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
    expect(overview.stats.distribution).toEqual([0, 0, 1, 0, 0, 0, 0, 0]);
    const wins10 = 'wordle_v2_wins_10';
    expect(
      overview.achievements.find((row) => row.id === wins10)?.progress,
    ).toEqual({ current: 1, target: 10 });
    expect(await earnedAchievements(userId, guildId)).toEqual([]);
    expect(await discoveryRows(userId, guildId)).toEqual([]);
    const result = await award(userId, guildId);
    expect(result.overview.stats).toEqual(overview.stats);
  });

  it('keeps locked secret metadata concealed and reveals only earned conditions', async () => {
    const { userId, guildId } = identity();
    const secret = WORDLE_ACHIEVEMENT_CATALOG.find(
      (row) => row.id === 'wordle_v2_secret_d6a09c31',
    );
    if (!secret) throw new Error('Secret definition missing');
    const status = (
      await service.getOverview(userId, guildId)
    ).achievements.find((row) => row.id === secret.id);
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
      solvedAt: 120,
    });
    await award(userId, guildId);
    const revealed = (
      await service.getOverview(userId, guildId)
    ).achievements.find((row) => row.id === secret.id);
    expect(revealed?.name).toBe(secret.name);
    expect(revealed?.unlockedAt).not.toBeNull();
  });

  it('includes all players with accepted guesses in holder percentages', async () => {
    const { userId, guildId } = identity();
    await seedAchievementDay(userId, guildId);
    await seedAchievementDay('other-player', guildId, { solved: false });
    await seedAchievementDay('old-player', guildId);
    await seedAchievementDay('empty-player', guildId, {
      attempts: 0,
      solved: false,
    });
    await award(userId, guildId);
    const id = 'wordle_v2_wins_1';
    expect(
      (await service.getOverview(userId, guildId)).achievements.find(
        (row) => row.id === id,
      )?.holdersPercent,
    ).toBe(33.33);
    expect(
      (await service.getOverview(userId, 'empty-guild')).achievements.every(
        (row) => row.holdersPercent === null,
      ),
    ).toBe(true);
  });

  it('counts historical and current sessions in stats and holder population', async () => {
    const { userId, guildId } = identity();
    const historicOnly = identity();
    await seedAchievementDay(userId, guildId, {
      date: '2025-12-31',
      attempts: 1,
    });
    await seedAchievementDay(userId, guildId, {
      date: '2026-01-01',
      attempts: 1,
    });
    await seedAchievementDay(historicOnly.userId, guildId, {
      date: '2025-12-30',
      attempts: 1,
    });

    const result = await award(userId, guildId);
    const overview = await service.getOverview(userId, guildId);
    const firstWin = 'wordle_v2_wins_1';
    expect(result.overview.stats).toMatchObject({ played: 2, wins: 2 });
    expect(
      overview.achievements.find((row) => row.id === firstWin)?.holdersPercent,
    ).toBe(50);
  });

  it('persists first legal evidence once across colors, later dates and backfill retries', async () => {
    const { userId, guildId } = identity();
    await seedAchievementDay(userId, guildId, {
      attempts: 2,
      width: 6,
      word: 'partes',
      guesses: guessesFor('partes', ['partam', 'partes']),
    });
    const first = await award(userId, guildId);
    const id = 'wordle_v2_pattern_tetromino_i';
    const badge = first.overview.achievements.find((row) => row.id === id);
    expect(badge?.patternPreview?.patternId).toBe('tetromino_i');
    expect(badge?.matchEvidence).toMatchObject({
      color: 'correct',
      date: '2026-01-01',
    });
    const before = await discoveryRows(userId, guildId);
    const xp = await achievementXp(userId, guildId);
    await seedAchievementDay(userId, guildId, {
      date: '2026-01-02',
      attempts: 1,
      solved: false,
      width: 6,
      word: 'partes',
      guesses: guessesFor('partes', ['partam']),
    });
    await service.backfill({ guildId, batchSize: 1 });
    expect(await discoveryRows(userId, guildId)).toEqual(before);
    const after = await service.backfill({ guildId, batchSize: 1 });
    expect(after).toEqual({ playersProcessed: 1, achievementsAwarded: 0 });
    expect(await achievementXp(userId, guildId)).toBe(xp);
    expect(
      (await service.getOverview(userId, guildId)).achievements.find(
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
    expect(result.unlockedIds).toContain('wordle_v2_wins_1');
    expect(await discoveryRows(userId, guildId)).toEqual([]);
    expect(
      result.overview.achievements.find((row) =>
        row.id.startsWith('wordle_v2_pattern_'),
      )?.matchEvidence,
    ).toBeNull();
  });

  it('does not persist a drawing when a solved board lacks its winning row', async () => {
    const { userId, guildId } = identity();
    await seedAchievementDay(userId, guildId, {
      attempts: 2,
      solved: true,
      guesses: guesses(['####.', '.....']),
    });

    const result = await award(userId, guildId);

    expect(result.unlockedIds).toContain('wordle_v2_wins_1');
    expect(await discoveryRows(userId, guildId)).toEqual([]);
  });

  it('retains evidence snapshots when saved gameplay is later changed', async () => {
    const { userId, guildId } = identity();
    await seedAchievementDay(userId, guildId, {
      attempts: 2,
      width: 6,
      word: 'partes',
      guesses: guessesFor('partes', ['partam', 'partes']),
    });
    await award(userId, guildId);
    const before = await discoveryRows(userId, guildId);
    const evidence = before.find((row) => row.pattern_id === 'tetromino_i');
    expect(evidence).toBeDefined();
    expect(
      wordlePatternEvidenceSchema.parse(evidence?.evidence).feedback,
    ).not.toHaveLength(0);
    await db
      .update(wordleSessions)
      .set({ guesses: '[]', attempts: 10 })
      .where(eq(wordleSessions.user_id, userId));
    await award(userId, guildId);
    await service.backfill({ guildId, batchSize: 1 });
    expect(await discoveryRows(userId, guildId)).toEqual(before);
  });

  it('rolls back discoveries together with unlocks and XP', async () => {
    const { userId, guildId } = identity();
    await seedAchievementDay(userId, guildId, {
      attempts: 2,
      width: 6,
      word: 'partes',
      guesses: guessesFor('partes', ['partam', 'partes']),
    });
    await expect(
      db.transaction(async (tx) => {
        await service.checkAndAward(userId, guildId, tx);
        const discoveries = await tx
          .select()
          .from(wordlePatternDiscoveries)
          .where(
            and(
              eq(wordlePatternDiscoveries.user_id, userId),
              eq(wordlePatternDiscoveries.guild_id, guildId),
            ),
          );
        const drawingId = 'wordle_v2_pattern_tetromino_i';
        expect(
          discoveries.some((row) => row.pattern_id === 'tetromino_i'),
        ).toBe(true);

        const unlocks = await tx
          .select()
          .from(userAchievements)
          .where(
            and(
              eq(userAchievements.user_id, userId),
              eq(userAchievements.guild_id, guildId),
            ),
          );
        expect(unlocks.some((row) => row.achievement_id === drawingId)).toBe(
          true,
        );

        const [level] = await tx
          .select()
          .from(userLevels)
          .where(
            and(
              eq(userLevels.user_id, userId),
              eq(userLevels.guild_id, guildId),
            ),
          );
        expect(level?.total_xp ?? 0).toBeGreaterThan(0);
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
    for (const pattern of WORDLE_DRAWING_CATALOG.filter(
      (row) => row.family === 'tetromino' && !remaining.has(row.patternId),
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
        pattern_id: pattern.patternId,
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
        created_at: 1,
      });
      return service.checkAndAward(userId, guildId, tx);
    });
    await new Promise((resolve) => setTimeout(resolve, 30));
    release();
    const results = await Promise.all([first, second]);
    const collectionId = 'wordle_v2_tetrominoes_all';
    expect(results[0].unlockedIds).not.toContain(collectionId);
    expect(results[1].unlockedIds).toContain(collectionId);
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
    expect((await award(userId, guildId)).unlockedIds).toEqual([]);
  });

  it('never invents missing solve timing and resolves guild first-solver ties', async () => {
    const { userId, guildId } = identity();
    await seedAchievementDay(userId, guildId, {
      id: `${guildId}-b`,
      solvedAt: 150,
    });
    await seedAchievementDay('first-player', guildId, {
      id: `${guildId}-a`,
      solvedAt: 150,
    });
    await seedAchievementDay(userId, guildId, { date: '2026-01-02' });
    const overview = await service.getOverview(userId, guildId);
    const firstSolver = overview.achievements.find(
      (row) => row.id === 'wordle_v2_first_solver_1',
    );
    expect(firstSolver?.progress?.current).toBe(0);
    const firstPlayerOverview = await service.getOverview(
      'first-player',
      guildId,
    );
    expect(
      firstPlayerOverview.achievements.find(
        (row) => row.id === 'wordle_v2_first_solver_1',
      )?.progress?.current,
    ).toBe(1);
  });
});
