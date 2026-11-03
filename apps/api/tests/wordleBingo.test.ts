import {
  wordleCommunityDailyPresence,
  wordleGlobalAcceptedGuesses,
  wordleGlobalDays,
  wordleGlobalOccurrences,
  wordleGlobalSessions,
} from '@marquinhos/database/schema';
import { createTestDb, type TestDb } from '@marquinhos/database/testing';
import { afterAll, beforeAll, expect, it } from 'bun:test';
import { WordleBingoService } from '../src/services/wordle/WordleBingoService';

let testDb: TestDb;
let bingo: WordleBingoService;
beforeAll(async () => {
  testDb = await createTestDb();
  bingo = new WordleBingoService(testDb.db, () => 100);
  await testDb.db.insert(wordleGlobalDays).values({
    word_date: '2026-11-01',
    word: 'termo',
    word_length: 5,
    created_at: 1,
  });
  await testDb.db.insert(wordleGlobalSessions).values({
    id: 'session',
    user_id: 'player',
    word_date: '2026-11-01',
    created_at: 1,
  });
  await testDb.db.insert(wordleGlobalAcceptedGuesses).values({
    session_id: 'session',
    user_id: 'player',
    word_date: '2026-11-01',
    attempt: 1,
    accepted_at: 250,
  });
  await testDb.db.insert(wordleCommunityDailyPresence).values({
    guild_id: 'a',
    user_id: 'player',
    word_date: '2026-11-01',
    first_seen_at: 0,
    recorded_at_ms: 0,
  });
  await testDb.db.insert(wordleGlobalOccurrences).values({
    user_id: 'player',
    word_date: '2026-11-01',
    pattern_id: 'tetromino_i',
    session_id: 'session',
    occurred_at: 300,
    source_at: 250,
    evidence: {
      patternId: 'tetromino_i',
      color: 'correct',
      origin: [0, 0],
      rotation: 0,
      cells: [
        [0, 0],
        [0, 1],
        [0, 2],
        [0, 3],
      ],
      feedback: [['correct', 'correct', 'correct', 'correct', 'absent']],
      date: '2026-11-01',
    },
  });
});
afterAll(async () => {
  await testDb.drop();
});

it('uses a fixed versioned card and does not count one guess twice without permission', async () => {
  const single = await bingo.create('a', 200, 500, false);
  const multiple = await bingo.create('a', 200, 500, true);
  expect(single.version).toBe(1);
  expect(single.cells).toHaveLength(9);
  expect(
    (await bingo.get(single.id, 'a')).progress.filled.filter(Boolean),
  ).toHaveLength(1);
  expect(
    (await bingo.get(multiple.id, 'a')).progress.filled.filter(Boolean).length,
  ).toBeGreaterThan(1);
  await expect(bingo.get(single.id, 'b')).rejects.toThrow();
});
