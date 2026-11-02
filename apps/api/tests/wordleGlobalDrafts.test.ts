import {
  wordleGlobalDays,
  wordleGlobalSessions,
} from '@marquinhos/database/schema';
import { createTestDb, type TestDb } from '@marquinhos/database/testing';
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { WordleGlobalDraftService } from '../src/services/wordle/WordleGlobalDraftService';

let testDb: TestDb;
const date = '2026-11-01';
const now = Date.parse('2026-11-01T15:00:00Z');
beforeAll(async () => {
  testDb = await createTestDb();
  await testDb.db
    .insert(wordleGlobalDays)
    .values({ word_date: date, word: 'termo', word_length: 5, created_at: 1 });
});
afterAll(async () => {
  await testDb.drop();
});

const draft = {
  date,
  rowIndex: 0,
  cells: ['t', 'e', '', '', ''],
  activeIndex: 2,
  expectedRevision: 0,
};
describe('global drafts', () => {
  it('saves a single draft per player and rejects stale edits', async () => {
    const service = new WordleGlobalDraftService(testDb.db, () => now);
    const first = await service.write('player', draft);
    expect(first.status).toBe('saved');
    const stale = await service.write('player', draft);
    expect(stale.status).toBe('conflict');
    expect(
      await service.getCurrentDraft('player', date, 0, false),
    ).toMatchObject({ cells: draft.cells, revision: 1 });
  });

  it('serializes simultaneous writes from different clients', async () => {
    const service = new WordleGlobalDraftService(testDb.db, () => now);
    const results = await Promise.all([
      service.write('concurrent', draft),
      service.write('concurrent', draft),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([
      'conflict',
      'saved',
    ]);
  });

  it('refuses drafts for a solved session or a different day', async () => {
    await testDb.db.insert(wordleGlobalSessions).values({
      id: 'solved-session',
      user_id: 'solved',
      word_date: date,
      solved: true,
      attempts: 1,
      created_at: 1,
    });
    const service = new WordleGlobalDraftService(testDb.db, () => now);
    expect(await service.write('solved', draft)).toEqual({ status: 'closed' });
    expect(
      await service.write('another', { ...draft, date: '2026-10-31' }),
    ).toEqual({ status: 'closed' });
  });

  it('rolls back a draft when the day changes before commit', async () => {
    let calls = 0;
    const service = new WordleGlobalDraftService(testDb.db, () =>
      ++calls <= 5 ? now : now + 24 * 60 * 60 * 1000,
    );
    expect(await service.write('cutoff', draft)).toEqual({ status: 'closed' });
    expect(await service.getCurrentDraft('cutoff', date, 0, false)).toBeNull();
  });
});
