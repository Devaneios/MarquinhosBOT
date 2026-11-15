import type { Db } from '@marquinhos/database/client';
import {
  wordleGlobalDays,
  wordleGlobalSessions,
} from '@marquinhos/database/schema';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { sql } from 'drizzle-orm';
import { prepareGlobalWordleCutover } from '../src/modules/wordle/migration/global-cutover';
import { auditWordlePreservation } from '../src/modules/wordle/migration/wordle-preservation';
import { WordleHistoryService } from '../src/modules/wordle/progression/wordle-history.service';
import { createWordleTestGlobalAchievementService } from './helpers/wordleServices';
import { createWordleV003Db } from './helpers/wordleV003Db';

let db: Db;
let drop: (() => Promise<void>) | undefined;
beforeEach(async () => {
  const fixture = await createWordleV003Db();
  db = fixture.db;
  drop = fixture.drop;
});
afterEach(async () => {
  await drop?.();
  drop = undefined;
});

async function preparedHistory() {
  await db.execute(sql`INSERT INTO users (id) VALUES ('u1')`);
  await db.execute(
    sql`INSERT INTO wordle_daily (guild_id, word, word_date, created_at) VALUES ('g1', 'termo', '2026-11-09', 100), ('g2', 'barco', '2026-11-09', 101)`,
  );
  await db.execute(sql`INSERT INTO wordle_sessions (id, user_id, guild_id, word_date, guesses, solved, attempts, created_at, word_length) VALUES
    ('s1', 'u1', 'g1', '2026-11-08', '[{"guess":"carta","feedback":["absent","absent","absent","correct","absent"]}]', true, 1, 80, 5),
    ('s2', 'u1', 'g1', '2026-11-09', '[{"guess":"carta","feedback":["absent","absent","absent","correct","absent"]}]', true, 1, 90, 5),
    ('s3', 'u1', 'g2', '2026-11-09', '[{"guess":"amigo","feedback":["absent","absent","absent","absent","absent"]}]', false, 1, 91, 5)`);
  await db.execute(
    sql`INSERT INTO wordle_streaks (user_id, guild_id, current_streak, max_streak, last_solved_date) VALUES ('u1', 'g1', 8, 20, '2026-11-09')`,
  );
  await db.execute(
    sql`INSERT INTO achievements (id, name, description, category, rarity, icon, condition, reward_xp) VALUES ('retired-wordle', 'Old name', 'Old description', 'wordle', 'rare', '🟣', '{}', 50)`,
  );
  await db.execute(
    sql`INSERT INTO user_achievements (user_id, guild_id, achievement_id, unlocked_at) VALUES ('u1', 'g1', 'retired-wordle', 110), ('u1', 'g2', 'retired-wordle', 120)`,
  );
  const before = await auditWordlePreservation(db);
  await (await import('@marquinhos/database/migrate')).runMigrations(db);
  await prepareGlobalWordleCutover(db, {
    sourceTag: 'v0.0.3',
    cutoverDate: '2026-11-10',
    before,
  });
  await db.insert(wordleGlobalDays).values({
    word_date: '2026-11-10',
    word: 'global',
    word_length: 6,
    created_at: 100,
  });
  await db.insert(wordleGlobalSessions).values({
    id: 'global-1',
    user_id: 'u1',
    word_date: '2026-11-10',
    guesses: '[]',
    solved: true,
    solved_from_draft: true,
    attempts: 0,
    created_at: 101,
  });
}

describe('Wordle preserved history', () => {
  test('combines source-identified games and continues the anchored streak', async () => {
    await preparedHistory();
    const history = new WordleHistoryService(db);
    expect(await history.getStats('u1', '2026-11-10')).toEqual({
      played: 4,
      wins: 3,
      winRate: 75,
      currentStreak: 9,
      bestStreak: 20,
      distribution: [1, 2, 0, 0, 0, 0, 0, 0],
    });
  });

  test('shows only each original guild board and keeps unknown-answer history', async () => {
    await preparedHistory();
    const history = new WordleHistoryService(db);
    expect(await history.getLegacyDayGuesses('g1', '2026-11-08')).toBeNull();
    expect(await history.getLegacyDayGuesses('g1', '2026-11-09')).toMatchObject(
      { word: 'termo', guesses: [{ guess: 'carta' }] },
    );
    expect(await history.getLegacyDayGuesses('g2', '2026-11-09')).toMatchObject(
      { word: 'barco', guesses: [{ guess: 'amigo' }] },
    );
  });

  test('returns original unlock fields with the earliest guild timestamp', async () => {
    await preparedHistory();
    expect(await new WordleHistoryService(db).getLegacyUnlocks('u1')).toEqual([
      {
        id: 'retired-wordle',
        name: 'Old name',
        description: 'Old description',
        icon: '🟣',
        rarity: 'rare',
        rewardXp: 50,
        unlockedAt: 110,
      },
    ]);
  });

  test('exposes combined progress and retired unlocks in the profile overview', async () => {
    await preparedHistory();
    const overview = await createWordleTestGlobalAchievementService(
      () => Date.parse('2026-11-10T12:00:00.000Z'),
      db,
    ).getOverview('u1', 'g1', 'u1');

    expect(overview.stats).toEqual({
      played: 4,
      wins: 3,
      winRate: 75,
      currentStreak: 9,
      bestStreak: 20,
      distribution: [1, 2, 0, 0, 0, 0, 0, 0],
    });
    expect(
      overview.achievements.find((row) => row.id === 'retired-wordle'),
    ).toMatchObject({
      family: 'wordle',
      name: 'Old name',
      unlockedAt: new Date(110).toISOString(),
    });
  });
});
