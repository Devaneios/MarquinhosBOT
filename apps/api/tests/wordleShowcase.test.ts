import {
  achievements,
  wordleGlobalAchievements,
} from '@marquinhos/database/schema';
import { createTestDb, type TestDb } from '@marquinhos/database/testing';
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { WordleShowcaseService } from '../src/services/wordle/WordleShowcaseService';

let testDb: TestDb;
let service: WordleShowcaseService;
beforeAll(async () => {
  testDb = await createTestDb();
  service = new WordleShowcaseService(testDb.db);
  await testDb.db.insert(achievements).values(
    ['one', 'two', 'three', 'other'].map((id) => ({
      id,
      name: id,
      description: id,
      category: 'wordle',
      rarity: 'common',
      icon: id,
    })),
  );
  await testDb.db.insert(wordleGlobalAchievements).values(
    ['one', 'two', 'three'].map((id) => ({
      user_id: 'player',
      achievement_id: id,
      unlocked_at: 1,
    })),
  );
});
afterAll(async () => {
  await testDb.drop();
});

describe('global Wordle showcase', () => {
  it('stores ordered owned achievements and supports replacement and clearing', async () => {
    expect(await service.get('player')).toEqual([]);
    await service.replace('player', ['two', 'one', 'three']);
    expect(await service.get('player')).toEqual(['two', 'one', 'three']);
    await service.replace('player', ['three']);
    expect(await service.get('player')).toEqual(['three']);
    await service.replace('player', []);
    expect(await service.get('player')).toEqual([]);
  });
  it('rejects duplicates, excessive and unowned ids without changing the existing showcase', async () => {
    await service.replace('player', ['one']);
    for (const ids of [
      ['one', 'one'],
      ['one', 'two', 'three', 'other'],
      ['other'],
      ['missing'],
    ]) {
      await expect(service.replace('player', ids)).rejects.toThrow();
      expect(await service.get('player')).toEqual(['one']);
    }
    expect(await service.get('another-player')).toEqual([]);
  });
  it('serializes simultaneous replacements without mixing slots', async () => {
    await Promise.all([
      service.replace('player', ['one', 'two']),
      service.replace('player', ['three', 'one']),
    ]);
    expect([
      ['one', 'two'],
      ['three', 'one'],
    ]).toContainEqual(await service.get('player'));
  });
});
