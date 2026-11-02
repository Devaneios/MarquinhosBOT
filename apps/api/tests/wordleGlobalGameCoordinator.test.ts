import {
  achievements,
  wordleGlobalAchievements,
  wordleGlobalDays,
} from '@marquinhos/database/schema';
import { createTestDb, type TestDb } from '@marquinhos/database/testing';
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { WordleGlobalAchievementService } from '../src/services/wordle/WordleGlobalAchievementService';
import { WordleGlobalGameCoordinator } from '../src/services/wordle/WordleGlobalGameCoordinator';
import { WordleGlobalGameplayService } from '../src/services/wordle/WordleGlobalGameplayService';

let testDb: TestDb;
const date = '2026-11-01';
const now = Date.parse('2026-11-01T15:00:00Z');
beforeAll(async () => {
  testDb = await createTestDb();
  await testDb.db
    .insert(wordleGlobalDays)
    .values({ word_date: date, word: 'termo', word_length: 5, created_at: 1 });
  await testDb.db.insert(achievements).values({
    id: 'wordle_v2_solved_exactly_1',
    name: 'Palpite certeiro',
    description: 'Acerte de primeira',
    category: 'wordle',
    rarity: 'rare',
    icon: 'x',
    reward_xp: 75,
  });
});
afterAll(async () => {
  await testDb.drop();
});

describe('global game coordinator', () => {
  it('awards after the accepted guess is committed', async () => {
    const gameplay = new WordleGlobalGameplayService(
      testDb.db,
      (guess) => guess,
      () => now,
    );
    const awards = new WordleGlobalAchievementService(testDb.db, () => now);
    const service = new WordleGlobalGameCoordinator(gameplay, awards, () => {});
    const result = await service.submitGuess(
      'player',
      'server-a',
      date,
      'termo',
    );
    expect(result).toMatchObject({
      solved: true,
      attempts: 1,
      unlockedIds: ['wordle_v2_solved_exactly_1'],
    });
    expect(
      await testDb.db.select().from(wordleGlobalAchievements),
    ).toHaveLength(1);
  });

  it('keeps a solved guess when awarding fails and supports later reconciliation', async () => {
    const gameplay = new WordleGlobalGameplayService(
      testDb.db,
      (guess) => guess,
      () => now,
    );
    const awards = new WordleGlobalAchievementService(testDb.db, () => now);
    const failing = new WordleGlobalGameCoordinator(
      gameplay,
      {
        checkAndAward: async () => {
          throw new Error('unavailable');
        },
      },
      () => {},
    );
    const result = await failing.submitGuess(
      'recover',
      'server-a',
      date,
      'termo',
    );
    expect(result).toMatchObject({ solved: true, attempts: 1 });
    expect(await gameplay.getSession('recover', date)).toMatchObject({
      solved: true,
      attempts: 1,
    });
    const retry = new WordleGlobalGameCoordinator(gameplay, awards, () => {});
    expect((await retry.reconcile('recover', 'server-a')).unlockedIds).toEqual([
      'wordle_v2_solved_exactly_1',
    ]);
    expect((await retry.reconcile('recover', 'server-b')).unlockedIds).toEqual(
      [],
    );
  });

  it('does not award for an invalid guess', async () => {
    const gameplay = new WordleGlobalGameplayService(
      testDb.db,
      () => null,
      () => now,
    );
    let awardCalls = 0;
    const service = new WordleGlobalGameCoordinator(gameplay, {
      checkAndAward: async () => {
        awardCalls++;
        return { unlockedIds: [] };
      },
    });
    expect(
      await service.submitGuess('invalid', 'server-a', date, 'bad'),
    ).toEqual({
      error: 'Palavra não encontrada na lista de palavras válidas.',
    });
    expect(awardCalls).toBe(0);
  });
});
