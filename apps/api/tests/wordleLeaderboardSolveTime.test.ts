import {
  wordleDays,
  wordleGlobalCutovers,
  wordleGlobalDays,
  wordleGlobalSessions,
  wordleSessions,
} from '@marquinhos/database/schema';
import { createTestDb, type TestDb } from '@marquinhos/database/testing';
import { afterAll, beforeAll, expect, it } from 'bun:test';
import { WordleGlobalLeaderboardService } from '../src/modules/wordle/gameplay/wordle-global-leaderboard.service';
import { createWordleTestPresence } from './helpers/wordleServices';

let testDb: TestDb;
beforeAll(async () => {
  testDb = await createTestDb();
  await testDb.db.insert(wordleGlobalCutovers).values({
    id: 'global-only-v003',
    source_tag: 'v0.0.3',
    cutover_date: '2026-11-02',
    source_digest: 'a'.repeat(64),
    verified_at: 1,
    completed_at: 1,
  });
});
afterAll(async () => {
  await testDb.drop();
});

for (const kind of ['legacy', 'global'] as const) {
  it(`${kind}: breaks daily attempt ties by solve time, preserving score priority and unknown historical times`, async () => {
    const date = kind === 'legacy' ? '2026-11-01' : '2026-11-02';
    const guildId = `solve-time-${kind}`;
    const at = Math.floor(Date.parse(`${date}T12:00:00Z`) / 1000);
    const day = {
      word_date: date,
      word: 'termo',
      word_length: 5,
      created_at: at,
    };
    const rows = [
      {
        user_id: 'started-first',
        solved: true,
        attempts: 2,
        created_at: at,
        solved_at: at + 600,
      },
      {
        user_id: 'finished-first',
        solved: true,
        attempts: 2,
        created_at: at + 300,
        solved_at: at + 360,
      },
      {
        user_id: 'one-guess',
        solved: true,
        attempts: 1,
        created_at: at + 900,
        solved_at: at + 900,
      },
      {
        user_id: 'unknown',
        solved: true,
        attempts: 2,
        created_at: at - 60,
        solved_at: null,
      },
      {
        user_id: 'unsolved',
        solved: false,
        attempts: 1,
        created_at: at - 120,
        solved_at: null,
      },
    ].map((row) => ({ ...row, id: `${kind}-${row.user_id}`, word_date: date }));
    if (kind === 'legacy') {
      await testDb.db
        .insert(wordleDays)
        .values({ ...day, guild_id: guildId, is_legacy: true });
      await testDb.db
        .insert(wordleSessions)
        .values(
          rows.map((row) => ({ ...row, guild_id: guildId, word_length: 5 })),
        );
    } else {
      await testDb.db.insert(wordleGlobalDays).values(day);
      await testDb.db.insert(wordleGlobalSessions).values(rows);
      for (const row of rows) {
        await createWordleTestPresence(
          testDb.db,
          row.user_id,
          guildId,
          date,
          at,
        );
      }
    }
    const service = new WordleGlobalLeaderboardService(testDb.db);
    expect(
      (await service.getLeaderboard(guildId, 'daily', date, 10)).map(
        (row) => row.userId,
      ),
    ).toEqual([
      'one-guess',
      'finished-first',
      'started-first',
      'unknown',
      'unsolved',
    ]);
    expect(
      (await service.getLeaderboard(guildId, 'daily', date, 1, 1)).map(
        (row) => row.userId,
      ),
    ).toEqual(['finished-first']);
  });
}
