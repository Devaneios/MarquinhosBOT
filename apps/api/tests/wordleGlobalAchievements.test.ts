import {
  achievements,
  userAchievements,
  userLevels,
  wordleAlbumContributions,
  wordleCommunityDailyPresence,
  wordleCommunityFirstSolves,
  wordleCommunityParticipation,
  wordleGlobalAcceptedGuesses,
  wordleGlobalAchievements,
  wordleGlobalDays,
  wordleGlobalDiscoveries,
  wordleGlobalOccurrences,
  wordleGlobalSessions,
} from '@marquinhos/database/schema';
import { createTestDb, type TestDb } from '@marquinhos/database/testing';
import { matchWordlePatterns } from '@marquinhos/domain/games/wordle/achievements/engine/matchPatterns';
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import { createWordleTestGlobalAchievementService } from './helpers/wordleServices';

let testDb: TestDb;
beforeAll(async () => {
  testDb = await createTestDb();
  await testDb.db.insert(achievements).values({
    id: 'wordle_v2_solved_exactly_1',
    name: 'Palpite certeiro',
    description: 'Acerte de primeira',
    category: 'wordle',
    rarity: 'rare',
    icon: 'x',
    reward_xp: 75,
  });
  await testDb.db.insert(wordleGlobalDays).values({
    word_date: '2026-01-01',
    word: 'termo',
    word_length: 5,
    created_at: 1,
  });
  await testDb.db.insert(wordleGlobalSessions).values({
    id: 'session',
    user_id: 'player',
    word_date: '2026-01-01',
    solved: true,
    attempts: 1,
    created_at: 100,
    solved_at: 101,
    guesses: JSON.stringify([
      {
        guess: 'termo',
        feedback: ['correct', 'correct', 'correct', 'correct', 'correct'],
      },
    ]),
  });
});
afterAll(async () => {
  await testDb.drop();
});

describe('global Wordle achievements', () => {
  it('shows a global collection and withholds today’s evidence from other players', async () => {
    const date = '2026-11-01';
    const feedback = [
      ['correct', 'correct', 'correct', 'correct', 'absent'],
    ] as const;
    const match = matchWordlePatterns(feedback).find(
      (item) => item.patternId === 'tetromino_i',
    )!;
    await testDb.db.insert(achievements).values({
      id: 'wordle_v2_pattern_tetromino_i',
      name: 'I',
      description: 'I',
      category: 'wordle',
      rarity: 'common',
      icon: 'x',
      reward_xp: 25,
    });
    await testDb.db.insert(wordleGlobalDays).values({
      word_date: date,
      word: 'termo',
      word_length: 5,
      created_at: 1,
    });
    await testDb.db.insert(wordleGlobalSessions).values({
      id: 'profile-session',
      user_id: 'profile-player',
      word_date: date,
      attempts: 1,
      guesses: JSON.stringify([{ guess: 'terma', feedback: feedback[0] }]),
      created_at: 1,
    });
    await testDb.db.insert(wordleGlobalAchievements).values({
      user_id: 'profile-player',
      achievement_id: 'wordle_v2_pattern_tetromino_i',
      unlocked_at: 1000,
    });
    await testDb.db.insert(wordleGlobalDiscoveries).values({
      user_id: 'profile-player',
      pattern_id: 'tetromino_i',
      session_id: 'profile-session',
      discovered_at: 1000,
      evidence: { ...match, feedback, date },
    });
    await testDb.db.insert(wordleCommunityParticipation).values([
      {
        user_id: 'profile-player',
        guild_id: 'profile-guild',
        first_seen_at: 1,
        last_seen_at: 1,
      },
      {
        user_id: 'friend',
        guild_id: 'profile-guild',
        first_seen_at: 1,
        last_seen_at: 1,
      },
    ]);
    const service = createWordleTestGlobalAchievementService(
      () => Date.parse('2026-11-01T15:00:00Z'),
      testDb.db,
    );
    const mine = await service.getOverview(
      'profile-player',
      'profile-guild',
      'profile-player',
    );
    const theirs = await service.getOverview(
      'profile-player',
      'profile-guild',
      'friend',
    );
    const self = mine.achievements.find(
      (item) => item.id === 'wordle_v2_pattern_tetromino_i',
    );
    const publicItem = theirs.achievements.find(
      (item) => item.id === 'wordle_v2_pattern_tetromino_i',
    );
    expect(mine.stats.played).toBe(1);
    expect(self?.matchEvidence?.date).toBe(date);
    expect(publicItem?.matchEvidence).toBeNull();
    expect(publicItem?.holdersPercent).toBe(50);
    expect(
      theirs.achievements.find(
        (item) => item.hidden && item.unlockedAt === null,
      )?.name,
    ).toBe('');
  });
  it('keeps retired unlocks visible and does not re-award a matching legacy unlock', async () => {
    await testDb.db.insert(achievements).values({
      id: 'retired-wordle-test',
      name: 'Retired title',
      description: 'Retired description',
      category: 'wordle',
      rarity: 'epic',
      icon: '🟣',
      reward_xp: 300,
    });
    await testDb.db.insert(userAchievements).values([
      {
        user_id: 'legacy-player',
        guild_id: 'legacy-a',
        achievement_id: 'retired-wordle-test',
        unlocked_at: 50,
      },
      {
        user_id: 'legacy-player',
        guild_id: 'legacy-b',
        achievement_id: 'retired-wordle-test',
        unlocked_at: 60,
      },
      {
        user_id: 'already-earned',
        guild_id: 'legacy-a',
        achievement_id: 'wordle_v2_solved_exactly_1',
        unlocked_at: 40,
      },
    ]);
    await testDb.db
      .insert(wordleCommunityParticipation)
      .values({
        user_id: 'legacy-player',
        guild_id: 'legacy-a',
        first_seen_at: 1,
        last_seen_at: 1,
      });
    await testDb.db.insert(wordleGlobalSessions).values({
      id: 'already-earned-session',
      user_id: 'already-earned',
      word_date: '2026-01-01',
      solved: true,
      attempts: 1,
      created_at: 100,
      solved_at: 101,
      guesses: JSON.stringify([
        {
          guess: 'termo',
          feedback: ['correct', 'correct', 'correct', 'correct', 'correct'],
        },
      ]),
    });
    await testDb.db
      .insert(userLevels)
      .values({
        user_id: 'already-earned',
        guild_id: 'legacy-a',
        total_xp: 999,
      });
    const service = createWordleTestGlobalAchievementService(
      () => Date.parse('2026-11-01T15:00:00Z'),
      testDb.db,
    );
    const overview = await service.getOverview(
      'legacy-player',
      'legacy-a',
      'legacy-player',
    );
    const retired = overview.achievements.find(
      (item) => item.id === 'retired-wordle-test',
    );
    expect(retired).toMatchObject({
      family: 'wordle',
      tier: 1,
      hidden: false,
      name: 'Retired title',
      description: 'Retired description',
      icon: '🟣',
      rarity: 'epic',
      rewardXp: 300,
      unlockedAt: new Date(50).toISOString(),
      progress: null,
      holdersPercent: null,
    });
    expect(retired).not.toHaveProperty('patternPreview');
    expect(await service.checkAndAward('already-earned', 'legacy-a')).toEqual({
      unlockedIds: [],
    });
    expect(
      await testDb.db
        .select()
        .from(wordleGlobalAchievements)
        .where(eq(wordleGlobalAchievements.user_id, 'already-earned')),
    ).toHaveLength(0);
    expect(
      (
        await testDb.db
          .select()
          .from(userLevels)
          .where(eq(userLevels.user_id, 'already-earned'))
      )[0]?.total_xp,
    ).toBe(999);
  });

  it('counts a first solve in two communities as one global achievement day', async () => {
    await testDb.db.insert(achievements).values({
      id: 'wordle_v2_first_solver_1',
      name: 'Primeiro',
      description: 'Primeiro acerto',
      category: 'wordle',
      rarity: 'common',
      icon: 'x',
      reward_xp: 25,
    });
    await testDb.db.insert(wordleGlobalDays).values({
      word_date: '2026-01-04',
      word: 'termo',
      word_length: 5,
      created_at: 1,
    });
    await testDb.db.insert(wordleGlobalSessions).values({
      id: 'first-solver-session',
      user_id: 'first-solver',
      word_date: '2026-01-04',
      solved: true,
      attempts: 2,
      created_at: 100,
      solved_at: 101,
      guesses: JSON.stringify([
        {
          guess: 'porta',
          feedback: ['absent', 'present', 'present', 'absent', 'absent'],
        },
        {
          guess: 'termo',
          feedback: ['correct', 'correct', 'correct', 'correct', 'correct'],
        },
      ]),
    });
    await testDb.db.insert(wordleCommunityFirstSolves).values([
      {
        guild_id: 'first-a',
        word_date: '2026-01-04',
        user_id: 'first-solver',
        session_id: 'first-solver-session',
        solved_at: 101,
      },
      {
        guild_id: 'first-b',
        word_date: '2026-01-04',
        user_id: 'first-solver',
        session_id: 'first-solver-session',
        solved_at: 101,
      },
    ]);
    const service = createWordleTestGlobalAchievementService(
      () => Date.parse('2026-11-01T15:00:00Z'),
      testDb.db,
    );
    expect(
      (await service.checkAndAward('first-solver', 'first-a')).unlockedIds,
    ).toEqual(['wordle_v2_first_solver_1']);
    expect(
      (await service.checkAndAward('first-solver', 'first-b')).unlockedIds,
    ).toEqual([]);
  });
  it('grants an achievement and its XP once across concurrent communities', async () => {
    const service = createWordleTestGlobalAchievementService(
      () => Date.parse('2026-11-01T15:00:00Z'),
      testDb.db,
    );
    const outcomes = await Promise.all([
      service.checkAndAward('player', 'guild-a'),
      service.checkAndAward('player', 'guild-b'),
    ]);
    expect(outcomes.flatMap((outcome) => outcome.unlockedIds)).toEqual([
      'wordle_v2_solved_exactly_1',
    ]);
    expect(
      (await testDb.db.select().from(wordleGlobalAchievements)).filter(
        (row) => row.user_id === 'player',
      ),
    ).toHaveLength(1);
    const levels = await testDb.db.select().from(userLevels);
    expect(
      levels
        .filter((row) => row.user_id === 'player')
        .reduce((total, row) => total + row.total_xp, 0),
    ).toBe(75);
  });

  it('records repeat occurrences while preserving the first discovery evidence', async () => {
    await testDb.db.insert(wordleGlobalDays).values([
      { word_date: '2026-01-02', word: 'termo', word_length: 5, created_at: 2 },
      { word_date: '2026-01-03', word: 'termo', word_length: 5, created_at: 3 },
    ]);
    const guesses = JSON.stringify([
      {
        guess: 'terma',
        feedback: ['correct', 'correct', 'correct', 'correct', 'absent'],
      },
    ]);
    await testDb.db.insert(wordleGlobalSessions).values([
      {
        id: 'pattern-one',
        user_id: 'pattern-player',
        word_date: '2026-01-02',
        attempts: 1,
        guesses,
        created_at: 2,
      },
      {
        id: 'pattern-two',
        user_id: 'pattern-player',
        word_date: '2026-01-03',
        attempts: 1,
        guesses,
        created_at: 3,
      },
    ]);
    await testDb.db.insert(wordleCommunityDailyPresence).values([
      {
        guild_id: 'guild-a',
        user_id: 'pattern-player',
        word_date: '2026-01-02',
        first_seen_at: 1,
      },
      {
        guild_id: 'guild-b',
        user_id: 'pattern-player',
        word_date: '2026-01-02',
        first_seen_at: 1,
      },
    ]);
    await testDb.db.insert(wordleGlobalAcceptedGuesses).values({
      session_id: 'pattern-one',
      user_id: 'pattern-player',
      word_date: '2026-01-02',
      attempt: 1,
      accepted_at: 1000,
    });
    const service = createWordleTestGlobalAchievementService(
      () => Date.parse('2026-11-01T15:00:00Z'),
      testDb.db,
    );
    await service.checkAndAward('pattern-player', 'guild-a');
    await service.checkAndAward('pattern-player', 'guild-b');
    const discoveries = (
      await testDb.db.select().from(wordleGlobalDiscoveries)
    ).filter(
      (row) =>
        row.user_id === 'pattern-player' && row.pattern_id === 'tetromino_i',
    );
    const occurrences = (
      await testDb.db.select().from(wordleGlobalOccurrences)
    ).filter(
      (row) =>
        row.user_id === 'pattern-player' && row.pattern_id === 'tetromino_i',
    );
    expect(discoveries).toHaveLength(1);
    expect(discoveries[0]?.session_id).toBe('pattern-one');
    expect(occurrences.map((row) => row.session_id).sort()).toEqual([
      'pattern-one',
      'pattern-two',
    ]);
    expect(
      occurrences.find((row) => row.session_id === 'pattern-one')?.source_at,
    ).toBe(1000);
    expect(
      occurrences.find((row) => row.session_id === 'pattern-two')?.source_at,
    ).toBeNull();
    const projected = (
      await testDb.db.select().from(wordleAlbumContributions)
    ).filter(
      (row) =>
        row.user_id === 'pattern-player' && row.pattern_id === 'tetromino_i',
    );
    expect(projected.map((row) => row.guild_id).sort()).toEqual([
      'guild-a',
      'guild-b',
    ]);
  });
});
