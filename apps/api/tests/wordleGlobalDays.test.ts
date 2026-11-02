import {
  wordleGlobalDays,
  wordleUsedWords,
  wordlistReview,
} from '@marquinhos/database/schema';
import { createTestDb, type TestDb } from '@marquinhos/database/testing';
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { WordleGlobalDayService } from '../src/services/wordle/WordleGlobalDayService';

let testDb: TestDb;
beforeAll(async () => {
  testDb = await createTestDb();
});
afterAll(async () => {
  await testDb.drop();
});

describe('global daily word', () => {
  it('selects once when multiple callers initialize the same day', async () => {
    const service = new WordleGlobalDayService(
      testDb.db,
      ['termo', 'carta'],
      [],
      () => 0,
      () => 1000,
    );
    const results = await Promise.all([
      service.getOrCreate('2026-11-01'),
      service.getOrCreate('2026-11-01'),
    ]);
    expect(results[0]).toEqual(results[1]);
    expect(await testDb.db.select().from(wordleGlobalDays)).toHaveLength(1);
    expect(await testDb.db.select().from(wordleUsedWords)).toHaveLength(1);
  });
  it('excludes banned and already used words across days', async () => {
    await testDb.db
      .insert(wordlistReview)
      .values({ word: 'barco', is_banned: true });
    const service = new WordleGlobalDayService(
      testDb.db,
      ['termo', 'barco', 'carta'],
      [],
      () => 0,
      () => 2000,
    );
    const result = await service.getOrCreate('2026-11-02');
    expect(result.word).toBe('carta');
  });
  it('fails without creating a day if no candidate exists', async () => {
    const service = new WordleGlobalDayService(
      testDb.db,
      ['termo', 'barco', 'carta'],
      [],
      () => 0,
      () => 3000,
    );
    await expect(service.getOrCreate('2026-11-03')).rejects.toThrow(
      'No available words left in the wordlist',
    );
    expect(await testDb.db.select().from(wordleGlobalDays)).toHaveLength(2);
  });

  it('serializes selection across different days to avoid reusing a word', async () => {
    const service = new WordleGlobalDayService(
      testDb.db,
      ['livro', 'letra'],
      [],
      () => 0,
      () => 4000,
    );
    const results = await Promise.all([
      service.getOrCreate('2026-11-04'),
      service.getOrCreate('2026-11-05'),
    ]);
    expect(new Set(results.map((result) => result.word)).size).toBe(2);
  });
});
