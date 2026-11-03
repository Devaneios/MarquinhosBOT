import {
  achievements,
  wordleGlobalAchievements,
} from '@marquinhos/database/schema';
import { createTestDb, type TestDb } from '@marquinhos/database/testing';
import { afterAll, beforeAll, expect, it } from 'bun:test';
import { WordleRewardsService } from '../src/services/wordle/WordleRewardsService';

let testDb: TestDb;
let rewards: WordleRewardsService;
beforeAll(async () => {
  testDb = await createTestDb();
  rewards = new WordleRewardsService(testDb.db);
  await testDb.db.insert(achievements).values(
    ['wordle_v2_letters_all', 'wordle_v2_wins_100'].map((id) => ({
      id,
      name: id,
      description: id,
      icon: 'x',
      category: 'wordle',
      rarity: 'common',
    })),
  );
});
afterAll(async () => {
  await testDb.drop();
});

it('grants owned rewards retroactively and equips only owned items', async () => {
  expect(await rewards.get('player')).toEqual({
    owned: [],
    title: null,
    frame: null,
  });
  await expect(
    rewards.equip('player', 'title', 'title_alphabetist'),
  ).rejects.toThrow();
  await testDb.db.insert(wordleGlobalAchievements).values({
    user_id: 'player',
    achievement_id: 'wordle_v2_letters_all',
    unlocked_at: 1,
  });
  await rewards.reconcile('player');
  await rewards.reconcile('player');
  await rewards.equip('player', 'title', 'title_alphabetist');
  await expect(
    rewards.equip('player', 'frame', 'title_alphabetist'),
  ).rejects.toThrow();
  expect(await rewards.get('player')).toEqual({
    owned: ['title_alphabetist'],
    title: 'title_alphabetist',
    frame: null,
  });
  await rewards.equip('player', 'title', null);
  expect(await rewards.get('player')).toEqual({
    owned: ['title_alphabetist'],
    title: null,
    frame: null,
  });
  expect(await rewards.get('other')).toEqual({
    owned: [],
    title: null,
    frame: null,
  });
});
