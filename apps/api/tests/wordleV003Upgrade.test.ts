import {
  achievements,
  userAchievements,
  userLevels,
  wordleCommunityFirstSolves,
  wordleGlobalAchievements,
  wordleLegacyProgress,
  wordleUsedWords,
} from '@marquinhos/database/schema';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { and, eq, sql } from 'drizzle-orm';
import { AchievementService } from '../src/modules/gamification/achievement.service';
import { LevelingService } from '../src/modules/gamification/leveling.service';
import { WordleGlobalDayService } from '../src/modules/wordle/gameplay/wordle-global-day.service';
import { prepareGlobalWordleCutover } from '../src/modules/wordle/migration/global-cutover';
import {
  auditWordlePreservation,
  verifyWordlePreservation,
} from '../src/modules/wordle/migration/wordle-preservation';
import { WordleHistoryService } from '../src/modules/wordle/progression/wordle-history.service';
import { assertGlobalWordleReady } from '../src/modules/wordle/wordle-readiness';
import { createWordleTestServices } from './helpers/wordleServices';
import { createWordleV003Db } from './helpers/wordleV003Db';

const CUTOFF = '2026-11-10';
const NOW = Date.parse('2026-11-10T12:00:00.000Z');
const absent = ['absent', 'absent', 'absent', 'absent', 'absent'];
const correct = ['correct', 'correct', 'correct', 'correct', 'correct'];
const rows = (...guesses: Array<{ guess: string; feedback: string[] }>) =>
  JSON.stringify(guesses);

let fixture: Awaited<ReturnType<typeof createWordleV003Db>>;
beforeEach(async () => {
  fixture = await createWordleV003Db();
});
afterEach(async () => {
  await fixture?.drop();
});

async function seedCompleteV003Source() {
  const db = fixture.db;
  const localLateNight = Math.floor(
    Date.parse('2026-11-10T02:30:00.000Z') / 1000,
  ); // 23:30 on Nov 9 in America/Recife.
  await db.execute(sql`INSERT INTO users (id) VALUES ('player'), ('other')`);
  await db.execute(sql`
    INSERT INTO wordle_daily
      (guild_id, word, word_date, players_count, winners_count, total_attempts, created_at)
    VALUES
      ('guild-a', 'termo', '2026-11-09', 1, 1, 2, 100),
      ('guild-b', 'carta', '2026-11-09', 1, 0, 0, 101)
  `);
  await db.execute(sql`
    INSERT INTO wordle_sessions
      (id, user_id, guild_id, word_date, guesses, solved, attempts, created_at, word_length)
    VALUES
      ('legacy-a', 'player', 'guild-a', '2026-11-09', ${rows(
        { guess: 'barco', feedback: absent },
        { guess: 'termo', feedback: correct },
      )}, true, 2, ${localLateNight}, 5),
      ('legacy-b', 'player', 'guild-b', '2026-11-09', ${rows({
        guess: 'termo',
        feedback: absent,
      })}, false, 1, 200, 5),
      ('legacy-unknown', 'player', 'guild-a', '2026-11-08', ${rows(
        { guess: 'barco', feedback: absent },
        { guess: 'carta', feedback: absent },
      )}, true, 2, 150, 5)
  `);
  await db.execute(sql`
    INSERT INTO wordle_streaks
      (user_id, guild_id, current_streak, max_streak, last_solved_date)
    VALUES ('player', 'guild-a', 8, 20, '2026-11-09'),
           ('player', 'guild-b', 4, 7, '2026-11-09')
  `);
  await db.execute(sql`
    INSERT INTO wordle_used_words (word, used_at)
    VALUES ('termo', 10), ('carta', 11)
  `);
  await db.execute(sql`
    INSERT INTO wordlist_review (word, is_banned)
    VALUES ('barco', true), ('praia', false)
  `);
  await db.execute(sql`
    INSERT INTO wordle_config (guild_id, channel_id, updated_at)
    VALUES ('guild-a', 'channel-a', 12), ('guild-b', 'channel-b', 13)
  `);
  await db.execute(sql`
    INSERT INTO wordle_user_config
      (user_id, invert_action_keys, enable_sounds, enable_space_key, enable_arrow_keys, updated_at)
    VALUES ('player', true, true, true, true, 14)
  `);
  await db.execute(sql`
    INSERT INTO achievements
      (id, name, description, category, rarity, icon, condition, reward_xp)
    VALUES ('retired-v003', 'Conquista antiga', 'Definição original', 'wordle', 'rare', '🟣', '{}', 80)
  `);
  await db.execute(sql`
    INSERT INTO user_achievements (user_id, guild_id, achievement_id, unlocked_at)
    VALUES ('player', 'guild-a', 'retired-v003', 77)
  `);
  await db.execute(sql`
    INSERT INTO user_levels (user_id, guild_id, level, xp, total_xp, updated_at)
    VALUES ('player', 'guild-a', 12, 900, 1200, 20),
           ('player', 'guild-b', 2, 73, 73, 21)
  `);
}

describe('v0.0.3 to global Wordle upgrade', () => {
  test('preserves source progress, history, and used words through a global solve', async () => {
    await seedCompleteV003Source();
    const db = fixture.db;
    const before = await auditWordlePreservation(db);
    expect(before.unknownAnswerDays).toBe(1);
    expect(before.multipleGuildPlayerDates).toBe(1);

    await fixture.upgrade();
    await prepareGlobalWordleCutover(db, {
      sourceTag: 'v0.0.3',
      cutoverDate: CUTOFF,
      before,
    });
    await assertGlobalWordleReady(db);

    const catalogs = new AchievementService(new LevelingService(db), db);
    await catalogs.initializeDefaults();
    const services = createWordleTestServices(db, {
      today: () => CUTOFF,
      now: () => NOW,
    });
    const constrainedPicker = new WordleGlobalDayService(
      db,
      () => ['termo', 'barco', 'praia'],
      () => ['termo', 'barco', 'praia'],
      () => 0.99,
      () => NOW,
    );
    Reflect.set(services.wordle, 'globalDay', constrainedPicker);

    const daily = await services.wordle.getDailyWord('guild-a');
    expect(daily.word).toBe('praia');
    expect(daily.word).not.toBe('termo');
    expect(daily.word).not.toBe('barco');
    expect(await services.wordle.getDailyWord('guild-b')).toMatchObject({
      word: 'praia',
      word_date: CUTOFF,
    });

    const preSolveOverview = await services.globalAchievements.getOverview(
      'player',
      'guild-a',
      'player',
    );
    for (const id of [
      'wordle_v2_midnight',
      'wordle_v2_first_solver_1',
      'wordle_v2_fast_60',
    ]) {
      expect(
        preSolveOverview.achievements.find(
          (achievement) => achievement.id === id,
        )?.unlockedAt,
      ).toBeNull();
    }
    expect(await db.select().from(wordleCommunityFirstSolves)).toEqual([]);

    const legacyA = await services.wordle.getDayGuesses(
      'guild-a',
      '2026-11-09',
    );
    const legacyB = await services.wordle.getDayGuesses(
      'guild-b',
      '2026-11-09',
    );
    expect(legacyA).toMatchObject({ word: 'termo', wordDate: '2026-11-09' });
    expect(legacyB).toMatchObject({ word: 'carta', wordDate: '2026-11-09' });
    expect(legacyA?.guesses.map((guess) => guess.guess)).toEqual(['barco']);
    expect(legacyB?.guesses.map((guess) => guess.guess)).toEqual(['termo']);
    expect(
      await services.wordle.getDayGuesses('guild-a', '2026-11-08'),
    ).toBeNull();

    const [anchor] = await db
      .select()
      .from(wordleLegacyProgress)
      .where(eq(wordleLegacyProgress.user_id, 'player'));
    expect(anchor).toMatchObject({
      current_streak: 8,
      best_streak: 20,
      last_solved_date: '2026-11-09',
      cutover_date: CUTOFF,
    });
    const [oldXp] = await db
      .select()
      .from(userLevels)
      .where(
        and(
          eq(userLevels.user_id, 'player'),
          eq(userLevels.guild_id, 'guild-a'),
        ),
      );
    const [oldUnlock] = await db
      .select()
      .from(userAchievements)
      .where(eq(userAchievements.achievement_id, 'retired-v003'));

    const solved = await services.wordle.submitGuess(
      'player',
      'guild-c',
      'praia',
    );
    expect(solved).toMatchObject({ solved: true, attempts: 1, streak: 9 });
    const sessionA = await services.wordle.getUserSession('player', 'guild-a');
    const sessionB = await services.wordle.getUserSession('player', 'guild-b');
    expect(sessionA?.id).toBe(sessionB?.id);
    expect(sessionA).toMatchObject({ solved: true, attempts: 1 });

    const stats = await new WordleHistoryService(db).getStats('player', CUTOFF);
    expect(stats).toEqual({
      played: 4,
      wins: 3,
      winRate: 75,
      currentStreak: 9,
      bestStreak: 20,
      distribution: [0, 1, 2, 0, 0, 0, 0, 0],
    });
    const overview = await services.globalAchievements.getOverview(
      'player',
      'guild-a',
      'player',
    );
    expect(overview.stats).toEqual(stats);
    expect(
      overview.achievements.find(
        (achievement) => achievement.id === 'retired-v003',
      ),
    ).toMatchObject({
      name: 'Conquista antiga',
      family: 'wordle',
      unlockedAt: new Date(77).toISOString(),
    });
    expect(
      await db
        .select()
        .from(wordleGlobalAchievements)
        .where(eq(wordleGlobalAchievements.achievement_id, 'retired-v003')),
    ).toEqual([]);
    const [oldXpAfter] = await db
      .select()
      .from(userLevels)
      .where(
        and(
          eq(userLevels.user_id, 'player'),
          eq(userLevels.guild_id, 'guild-a'),
        ),
      );
    const [oldUnlockAfter] = await db
      .select()
      .from(userAchievements)
      .where(eq(userAchievements.achievement_id, 'retired-v003'));
    expect(oldXpAfter).toEqual(oldXp);
    expect(oldUnlockAfter).toEqual(oldUnlock);
    expect(await db.select().from(wordleUsedWords)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ word: 'termo', used_at: 10 }),
        expect.objectContaining({ word: 'carta', used_at: 11 }),
        expect.objectContaining({ word: 'praia' }),
      ]),
    );

    const sourceAfter = await verifyWordlePreservation(db, before);
    expect(sourceAfter).toEqual({ ok: true, mismatches: {} });
    const [legacyTimingData] = await db.execute<{
      solved_at: number | null;
      first_solver: boolean | null;
    }>(
      sql`SELECT solved_at, first_solver FROM wordle_sessions WHERE id = 'legacy-a'`,
    );
    expect(legacyTimingData).toEqual({ solved_at: null, first_solver: null });
    expect(
      await db
        .select()
        .from(achievements)
        .where(eq(achievements.id, 'retired-v003')),
    ).toHaveLength(1);
  });

  test('keeps startup closed after a failed boundary conversion, then retries safely', async () => {
    const db = fixture.db;
    await db.execute(sql`INSERT INTO users (id) VALUES ('boundary-player')`);
    const lateUtcTimestamp = Math.floor(
      Date.parse('2026-11-10T02:30:00.000Z') / 1000,
    );
    await db.execute(sql`
      INSERT INTO wordle_sessions
        (id, user_id, guild_id, word_date, guesses, solved, attempts, created_at, word_length)
      VALUES ('boundary-session', 'boundary-player', 'guild', '2026-11-10', 'not-json', false, 1, ${lateUtcTimestamp}, 5)
    `);
    const before = await auditWordlePreservation(db);
    await fixture.upgrade();

    await expect(
      prepareGlobalWordleCutover(db, {
        sourceTag: 'v0.0.3',
        cutoverDate: CUTOFF,
        before,
      }),
    ).rejects.toThrow(
      /invalid_legacy_session|legacy_session_on_or_after_cutover/,
    );
    await expect(assertGlobalWordleReady(db)).rejects.toThrow(
      'prepare and verify the global cutover',
    );
    expect(await db.select().from(wordleLegacyProgress)).toEqual([]);

    // The UTC timestamp is already Nov 10, but the game date is still Nov 9 in Recife.
    await db.execute(sql`
      UPDATE wordle_sessions
      SET word_date = '2026-11-09',
          guesses = ${rows({ guess: 'barco', feedback: absent })},
          attempts = 1
      WHERE id = 'boundary-session'
    `);
    await db.execute(sql`
      DELETE FROM wordle_days
      WHERE guild_id = 'guild' AND word_date >= ${CUTOFF}
    `);
    const correctedInventory = await auditWordlePreservation(db);
    await prepareGlobalWordleCutover(db, {
      sourceTag: 'v0.0.3',
      cutoverDate: CUTOFF,
      before: correctedInventory,
    });
    await assertGlobalWordleReady(db);

    const [legacyRow] = await db.execute<{
      solved_at: number | null;
      first_solver: boolean | null;
    }>(
      sql`SELECT solved_at, first_solver FROM wordle_sessions WHERE id = 'boundary-session'`,
    );
    expect(legacyRow).toEqual({ solved_at: null, first_solver: null });
    const services = createWordleTestServices(db, {
      today: () => CUTOFF,
      now: () => NOW,
    });
    const overview = await services.globalAchievements.getOverview(
      'boundary-player',
      'guild',
      'boundary-player',
    );
    for (const id of [
      'wordle_v2_midnight',
      'wordle_v2_first_solver_1',
      'wordle_v2_fast_60',
    ]) {
      expect(
        overview.achievements.find((achievement) => achievement.id === id)
          ?.unlockedAt,
      ).toBeNull();
    }
    expect(await db.select().from(wordleCommunityFirstSolves)).toEqual([]);
  });
});
