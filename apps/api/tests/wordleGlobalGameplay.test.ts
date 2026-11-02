import {
  wordleGlobalDays,
  wordleGlobalSessions,
} from '@marquinhos/database/schema';
import { createTestDb, type TestDb } from '@marquinhos/database/testing';
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { WordleGlobalDraftService } from '../src/services/wordle/WordleGlobalDraftService';
import { WordleGlobalGameplayService } from '../src/services/wordle/WordleGlobalGameplayService';

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

describe('global gameplay', () => {
  it('shares a session across callers and resolves the same daily word', async () => {
    const game = new WordleGlobalGameplayService(
      testDb.db,
      (word) => word,
      () => now,
    );
    const first = await game.submitGuess('player', date, 'porta');
    expect(first).toMatchObject({ solved: false, attempts: 1 });
    const second = await game.submitGuess('player', date, 'termo');
    expect(second).toMatchObject({ solved: true, attempts: 2 });
    expect((await game.getSession('player', date))?.guesses).toHaveLength(2);
  });

  it('serializes simultaneous guesses into one session', async () => {
    const game = new WordleGlobalGameplayService(
      testDb.db,
      (word) => word,
      () => now,
    );
    const results = await Promise.all([
      game.submitGuess('concurrent', date, 'porta'),
      game.submitGuess('concurrent', date, 'carta'),
    ]);
    expect(
      results.map((value) => ('attempts' in value ? value.attempts : 0)).sort(),
    ).toEqual([1, 2]);
    expect((await game.getSession('concurrent', date))?.guesses).toHaveLength(
      2,
    );
    expect(
      (await testDb.db.select().from(wordleGlobalSessions)).filter(
        (row) => row.user_id === 'concurrent',
      ),
    ).toHaveLength(1);
  });

  it('does not allow a repeat guess or edit after solving', async () => {
    const game = new WordleGlobalGameplayService(
      testDb.db,
      (word) => word,
      () => now,
    );
    await game.submitGuess('duplicates', date, 'porta');
    expect(await game.submitGuess('duplicates', date, 'porta')).toEqual({
      error: 'Você já tentou essa palavra.',
    });
    await game.submitGuess('duplicates', date, 'termo');
    expect(await game.submitGuess('duplicates', date, 'carta')).toEqual({
      error: 'Você já acertou a palavra de hoje!',
    });
  });

  it('resets the draft after an accepted guess and clears it after solving', async () => {
    const game = new WordleGlobalGameplayService(
      testDb.db,
      (word) => word,
      () => now,
    );
    const drafts = new WordleGlobalDraftService(testDb.db, () => now);
    await drafts.write('draft-player', {
      date,
      rowIndex: 0,
      cells: ['p', 'o', '', '', ''],
      activeIndex: 2,
      expectedRevision: 0,
    });
    await game.submitGuess('draft-player', date, 'porta');
    expect(
      await drafts.getCurrentDraft('draft-player', date, 1, false),
    ).toMatchObject({ rowIndex: 1, revision: 2, cells: ['', '', '', '', ''] });
    await game.submitGuess('draft-player', date, 'termo');
    expect(
      await drafts.getCurrentDraft('draft-player', date, 1, false),
    ).toBeNull();
  });

  it('rolls back the session when the day changes during a guess', async () => {
    let calls = 0;
    const game = new WordleGlobalGameplayService(
      testDb.db,
      (word) => word,
      () => (++calls <= 3 ? now : now + 86400000),
    );
    expect(await game.submitGuess('cutoff', date, 'porta')).toEqual({
      error: 'O dia do jogo mudou. Envie o palpite novamente.',
    });
    expect(await game.getSession('cutoff', date)).toBeNull();
  });
});
