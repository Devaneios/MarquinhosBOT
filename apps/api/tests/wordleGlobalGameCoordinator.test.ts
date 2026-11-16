import {
  achievements,
  userAchievements,
  userLevels,
  wordleGlobalAchievements,
  wordleGlobalDays,
} from '@marquinhos/database/schema';
import { createTestDb, type TestDb } from '@marquinhos/database/testing';
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import { WordleReconcileJob } from '../src/jobs/wordle-reconcile.job';
import { WordleGlobalGameCoordinator } from '../src/modules/wordle/gameplay/wordle-global-game-coordinator';
import { WordleGlobalGameplayService } from '../src/modules/wordle/gameplay/wordle-global-gameplay.service';
import { lockWordleAchievements } from '../src/modules/wordle/progression/wordle-achievement-lock';
import {
  createWordleTestGlobalAchievementService,
  createWordleTestServices,
} from './helpers/wordleServices';

let testDb: TestDb;
const date = '2026-11-01';
const now = Date.parse('2026-11-01T15:00:00Z');
beforeAll(async () => {
  testDb = await createTestDb();
  await testDb.db
    .insert(wordleGlobalDays)
    .values({ word_date: date, word: 'termo', word_length: 5, created_at: 1 });
  await testDb.db.insert(achievements).values({
    id: 'wordle_v2_solved_exactly_1',
    name: 'Palpite certeiro',
    description: 'Acerte de primeira',
    category: 'wordle',
    rarity: 'rare',
    icon: 'x',
    reward_xp: 75,
  });
});
afterAll(async () => {
  await testDb.drop();
});

describe('global game coordinator', () => {
  it('replays a lost winning response without another attempt or reward', async () => {
    const requestId = '1e934f2b-a691-4c08-94f4-d82df6968b27';
    const service = new WordleGlobalGameCoordinator(
      new WordleGlobalGameplayService(
        testDb.db,
        (guess) => guess,
        () => now,
      ),
      createWordleTestGlobalAchievementService(() => now, testDb.db),
    );
    const first = await service.submitGuess(
      'lost-response-player',
      'server-a',
      date,
      'termo',
      true,
      requestId,
    );
    const replay = await service.submitGuess(
      'lost-response-player',
      'server-a',
      date,
      'termo',
      true,
      requestId,
    );
    expect(first).toMatchObject({
      solved: true,
      attempts: 1,
      requestId,
      achievementBaseline: [],
    });
    expect(replay).toMatchObject({
      solved: true,
      attempts: 1,
      requestId,
      achievementBaseline: [],
      guesses: [{ guess: 'termo' }],
    });
    const [level] = await testDb.db
      .select()
      .from(userLevels)
      .where(eq(userLevels.user_id, 'lost-response-player'));
    expect(level?.total_xp).toBe(75);
  });
  it('replays a saved guess after the day or validation bank changes', async () => {
    const requestId = '5e934f2b-a691-4c08-94f4-d82df6968b27';
    let clock = now;
    let valid = true;
    const gameplay = new WordleGlobalGameplayService(
      testDb.db,
      (guess) => (valid ? guess : null),
      () => clock,
    );
    const first = await gameplay.submitGuess(
      'midnight-player',
      date,
      'termo',
      'server-a',
      true,
      requestId,
    );
    expect(first).toMatchObject({ solved: true, attempts: 1, requestId });
    clock += 86_400_000;
    valid = false;
    const replay = await gameplay.submitGuess(
      'midnight-player',
      date,
      'termo',
      'server-a',
      true,
      requestId,
    );
    expect(replay).toMatchObject({
      solved: true,
      attempts: 1,
      requestId,
      achievementBaseline: [],
    });
    const absent = await gameplay.submitGuess(
      'midnight-player',
      date,
      'termo',
      'server-a',
      true,
      '6e934f2b-a691-4c08-94f4-d82df6968b27',
    );
    expect(absent).toHaveProperty('error');
  });
  it('replays a bot request after the daily date changes', async () => {
    const requestId = '8e934f2b-a691-4c08-94f4-d82df6968b27';
    let clock = now;
    let today = date;
    await testDb.db
      .insert(wordleGlobalDays)
      .values({
        word_date: '2026-11-02',
        word: 'carta',
        word_length: 5,
        created_at: 1,
      })
      .onConflictDoNothing();
    const { wordle } = createWordleTestServices(testDb.db, {
      now: () => clock,
      today: () => today,
    });
    const first = await wordle.submitGuess(
      'midnight-bot-player',
      'server-a',
      'termo',
      false,
      requestId,
      date,
    );
    expect(first).toMatchObject({ solved: true, attempts: 1, requestId });
    clock += 86_400_000;
    today = '2026-11-02';
    const replay = await wordle.submitGuess(
      'midnight-bot-player',
      'server-a',
      'termo',
      false,
      requestId,
      date,
    );
    expect(replay).toMatchObject({ solved: true, attempts: 1, requestId });
  });
  it('serializes concurrent retries and rejects reusing an id for another guess', async () => {
    const requestId = '2e934f2b-a691-4c08-94f4-d82df6968b27';
    const gameplay = new WordleGlobalGameplayService(
      testDb.db,
      (guess) => guess,
      () => now,
    );
    const service = new WordleGlobalGameCoordinator(
      gameplay,
      createWordleTestGlobalAchievementService(() => now, testDb.db),
    );
    const results = await Promise.all([
      service.submitGuess(
        'concurrent-retry-player',
        'server-a',
        date,
        'termo',
        true,
        requestId,
      ),
      service.submitGuess(
        'concurrent-retry-player',
        'server-a',
        date,
        'termo',
        true,
        requestId,
      ),
    ]);
    expect(
      results.every(
        (result) =>
          !('error' in result) && result.solved && result.attempts === 1,
      ),
    ).toBe(true);
    const [level] = await testDb.db
      .select()
      .from(userLevels)
      .where(eq(userLevels.user_id, 'concurrent-retry-player'));
    expect(level?.total_xp).toBe(75);
    expect(
      await service.submitGuess(
        'concurrent-retry-player',
        'server-a',
        date,
        'porta',
        true,
        requestId,
      ),
    ).toEqual({ error: 'Identificador de palpite já utilizado.' });
  });
  it('keeps the original community when a failed award is retried elsewhere', async () => {
    const requestId = '4e934f2b-a691-4c08-94f4-d82df6968b27';
    const gameplay = new WordleGlobalGameplayService(
      testDb.db,
      (guess) => guess,
      () => now,
    );
    const failing = new WordleGlobalGameCoordinator(gameplay, {
      checkAndAward: async () => {
        throw new Error('temporary failure');
      },
      getOverview: async () => {
        throw new Error('temporary failure');
      },
    });
    await failing.submitGuess(
      'retry-guild-player',
      'original-guild',
      date,
      'termo',
      true,
      requestId,
    );
    const retry = new WordleGlobalGameCoordinator(
      gameplay,
      createWordleTestGlobalAchievementService(() => now, testDb.db),
    );
    const replay = await retry.submitGuess(
      'retry-guild-player',
      'new-guild',
      date,
      'termo',
      true,
      requestId,
    );
    expect(replay).toMatchObject({ solved: true, attempts: 1, requestId });
    const [level] = await testDb.db
      .select()
      .from(userLevels)
      .where(eq(userLevels.user_id, 'retry-guild-player'));
    expect(level).toMatchObject({ guild_id: 'original-guild', total_xp: 75 });
  });
  it('waits for an in-flight award before capturing its baseline', async () => {
    await testDb.db.insert(achievements).values({
      id: 'concurrent-old',
      name: 'Old',
      description: 'Old',
      category: 'wordle',
      rarity: 'common',
      icon: 'x',
      reward_xp: 0,
    });
    let unlock!: () => void;
    let acquired!: () => void;
    const release = new Promise<void>((resolve) => {
      unlock = resolve;
    });
    const locked = new Promise<void>((resolve) => {
      acquired = resolve;
    });
    const award = testDb.db.transaction(async (tx) => {
      await lockWordleAchievements(tx, 'locked-baseline-player');
      await tx.insert(wordleGlobalAchievements).values({
        user_id: 'locked-baseline-player',
        achievement_id: 'concurrent-old',
        unlocked_at: now - 1,
      });
      acquired();
      await release;
    });
    await locked;
    const gameplay = new WordleGlobalGameplayService(
      testDb.db,
      (guess) => guess,
      () => now,
    );
    const attempt = gameplay.submitGuess(
      'locked-baseline-player',
      date,
      'termo',
      'server-a',
      true,
    );
    await new Promise((resolve) => setTimeout(resolve, 30));
    unlock();
    await award;
    const result = await attempt;
    if ('error' in result) throw new Error(result.error);
    expect(result.achievementBaseline).toEqual(['concurrent-old']);
  });
  it('captures existing global and legacy unlocks before awarding the accepted guess', async () => {
    await testDb.db.insert(achievements).values([
      {
        id: 'baseline-global',
        name: 'Global',
        description: 'Old',
        category: 'wordle',
        rarity: 'common',
        icon: 'x',
        reward_xp: 0,
      },
      {
        id: 'baseline-legacy',
        name: 'Legacy',
        description: 'Old',
        category: 'wordle',
        rarity: 'common',
        icon: 'x',
        reward_xp: 0,
      },
    ]);
    await testDb.db.insert(wordleGlobalAchievements).values({
      user_id: 'baseline-player',
      achievement_id: 'baseline-global',
      unlocked_at: now - 1,
    });
    await testDb.db.insert(userAchievements).values({
      user_id: 'baseline-player',
      guild_id: 'old-guild',
      achievement_id: 'baseline-legacy',
      unlocked_at: now - 2,
    });
    const service = new WordleGlobalGameCoordinator(
      new WordleGlobalGameplayService(
        testDb.db,
        (guess) => guess,
        () => now,
      ),
      createWordleTestGlobalAchievementService(() => now, testDb.db),
    );
    const result = await service.submitGuess(
      'baseline-player',
      'server-a',
      date,
      'termo',
      true,
    );
    if ('error' in result) throw new Error(result.error);
    expect(result.achievementBaseline?.sort()).toEqual([
      'baseline-global',
      'baseline-legacy',
    ]);
    expect(
      'achievementUpdate' in result
        ? result.achievementUpdate.unlockedIds
        : undefined,
    ).toEqual(['wordle_v2_solved_exactly_1']);
  });
  it('automatically retries a committed award with its original community after a restart', async () => {
    const gameplay = new WordleGlobalGameplayService(
      testDb.db,
      (guess) => guess,
      () => now,
    );
    const interrupted = new WordleGlobalGameCoordinator(gameplay, {
      checkAndAward: async () => {
        throw new Error('temporary outage');
      },
      getOverview: async () => {
        throw new Error('temporary outage');
      },
    });
    expect(
      await interrupted.submitGuess(
        'background-player',
        'original-community',
        date,
        'termo',
      ),
    ).toMatchObject({ solved: true });

    const restarted = createWordleTestServices(testDb.db, {
      now: () => now,
      today: () => date,
    });
    const job = new WordleReconcileJob(
      restarted.notifications,
      restarted.goals,
      restarted.gallery,
      restarted.globalCoordinator,
      restarted.album,
    );
    expect(
      await restarted.globalGameplay.pendingAwards('background-player'),
    ).toHaveLength(1);
    const finished = Promise.withResolvers<void>();
    const queuePreviousWeek = restarted.gallery.queuePreviousWeek.bind(
      restarted.gallery,
    );
    restarted.gallery.queuePreviousWeek = async () => {
      try {
        return await queuePreviousWeek();
      } finally {
        finished.resolve();
      }
    };
    job.onApplicationBootstrap();
    await finished.promise;
    expect(
      await restarted.globalGameplay.pendingAwards('background-player'),
    ).toHaveLength(0);
    await job.reconcileOnInterval();
    const [award] = await testDb.db
      .select()
      .from(wordleGlobalAchievements)
      .where(eq(wordleGlobalAchievements.user_id, 'background-player'));
    expect(award?.achievement_id).toBe('wordle_v2_solved_exactly_1');
    const [level] = await testDb.db
      .select()
      .from(userLevels)
      .where(eq(userLevels.user_id, 'background-player'));
    expect(level).toMatchObject({
      guild_id: 'original-community',
      total_xp: 75,
    });
  });
  it('continues processing other players when an award fails and retries it later', async () => {
    let clock = now;
    const gameplay = new WordleGlobalGameplayService(
      testDb.db,
      (guess) => guess,
      () => clock,
    );
    await gameplay.submitGuess('retry-player', date, 'termo', 'retry-guild');
    await gameplay.submitGuess('other-player', date, 'termo', 'other-guild');
    const awards = createWordleTestGlobalAchievementService(
      () => clock,
      testDb.db,
    );
    let fail = true;
    const coordinator = new WordleGlobalGameCoordinator(gameplay, {
      checkAndAward: async (userId, guildId) => {
        if (userId === 'retry-player' && fail)
          throw new Error('temporary outage');
        return awards.checkAndAward(userId, guildId);
      },
      getOverview: (userId, guildId, viewerId) =>
        awards.getOverview(userId, guildId, viewerId),
    });
    await coordinator.reconcilePending();
    expect(
      await testDb.db
        .select()
        .from(wordleGlobalAchievements)
        .where(eq(wordleGlobalAchievements.user_id, 'other-player')),
    ).toHaveLength(1);
    expect(
      await testDb.db
        .select()
        .from(wordleGlobalAchievements)
        .where(eq(wordleGlobalAchievements.user_id, 'retry-player')),
    ).toHaveLength(0);
    fail = false;
    await coordinator.reconcilePending();
    expect(
      await testDb.db
        .select()
        .from(wordleGlobalAchievements)
        .where(eq(wordleGlobalAchievements.user_id, 'retry-player')),
    ).toHaveLength(0);
    clock += 60_000;
    await coordinator.reconcilePending();
    expect(
      await testDb.db
        .select()
        .from(wordleGlobalAchievements)
        .where(eq(wordleGlobalAchievements.user_id, 'retry-player')),
    ).toHaveLength(1);
  });
  it('grants XP once when a retry races with another reconciliation', async () => {
    const gameplay = new WordleGlobalGameplayService(
      testDb.db,
      (guess) => guess,
      () => now,
    );
    await gameplay.submitGuess('race-player', date, 'termo', 'race-guild');
    const awards = createWordleTestGlobalAchievementService(
      () => now,
      testDb.db,
    );
    const coordinator = new WordleGlobalGameCoordinator(gameplay, awards);
    await Promise.all([
      coordinator.reconcilePending(),
      coordinator.reconcile('race-player', 'race-guild'),
    ]);
    const earned = await testDb.db
      .select()
      .from(wordleGlobalAchievements)
      .where(eq(wordleGlobalAchievements.user_id, 'race-player'));
    const [level] = await testDb.db
      .select()
      .from(userLevels)
      .where(eq(userLevels.user_id, 'race-player'));
    expect(earned).toHaveLength(1);
    expect(level?.total_xp).toBe(75);
  });
  it('keeps the overview available if reconciliation temporarily fails', async () => {
    const { wordle, globalCoordinator } = createWordleTestServices(testDb.db, {
      now: () => now,
      today: () => date,
    });
    globalCoordinator.reconcile = async () => {
      throw new Error('unavailable');
    };
    const overview = await wordle.getAchievementsOverview(
      'overview-player',
      'server-a',
      'overview-player',
    );
    expect(overview.achievements.length).toBeGreaterThan(0);
    const refreshed = await wordle.refreshAchievements(
      'overview-player',
      'server-a',
    );
    expect(refreshed.pending).toBe(true);
  });
  it('reconciles a missed award when the player reloads their overview', async () => {
    const gameplay = new WordleGlobalGameplayService(
      testDb.db,
      (guess) => guess,
      () => now,
    );
    await gameplay.submitGuess('reload-player', date, 'termo');
    const { wordle } = createWordleTestServices(testDb.db, {
      now: () => now,
      today: () => date,
    });
    const overview = await wordle.getAchievementsOverview(
      'reload-player',
      'server-a',
      'reload-player',
    );
    expect(
      overview.achievements.find(
        (item) => item.id === 'wordle_v2_solved_exactly_1',
      )?.unlockedAt,
    ).toEqual(expect.any(String));
    await wordle.getAchievementsOverview(
      'reload-player',
      'server-a',
      'reload-player',
    );
    expect(
      await testDb.db
        .select()
        .from(wordleGlobalAchievements)
        .where(eq(wordleGlobalAchievements.user_id, 'reload-player')),
    ).toHaveLength(1);
  });
  it('awards after the accepted guess is committed', async () => {
    const gameplay = new WordleGlobalGameplayService(
      testDb.db,
      (guess) => guess,
      () => now,
    );
    const awards = createWordleTestGlobalAchievementService(
      () => now,
      testDb.db,
    );
    const service = new WordleGlobalGameCoordinator(gameplay, awards);
    const result = await service.submitGuess(
      'player',
      'server-a',
      date,
      'termo',
    );
    expect(result).toMatchObject({
      solved: true,
      attempts: 1,
      achievementUpdate: {
        unlockedIds: ['wordle_v2_solved_exactly_1'],
        overview: { stats: { played: 1, wins: 1 } },
      },
    });
    expect(
      await testDb.db
        .select()
        .from(wordleGlobalAchievements)
        .where(eq(wordleGlobalAchievements.user_id, 'player')),
    ).toHaveLength(1);
  });

  it('keeps a solved guess when awarding fails and supports later reconciliation', async () => {
    const gameplay = new WordleGlobalGameplayService(
      testDb.db,
      (guess) => guess,
      () => now,
    );
    const awards = createWordleTestGlobalAchievementService(
      () => now,
      testDb.db,
    );
    const failing = new WordleGlobalGameCoordinator(gameplay, {
      checkAndAward: async () => {
        throw new Error('unavailable');
      },
      getOverview: async () => {
        throw new Error('unavailable');
      },
    });
    const result = await failing.submitGuess(
      'recover',
      'server-a',
      date,
      'termo',
    );
    expect(result).toMatchObject({ solved: true, attempts: 1 });
    expect(await gameplay.getSession('recover', date)).toMatchObject({
      solved: true,
      attempts: 1,
    });
    const retry = new WordleGlobalGameCoordinator(gameplay, awards);
    expect((await retry.reconcile('recover', 'server-a')).unlockedIds).toEqual([
      'wordle_v2_solved_exactly_1',
    ]);
    expect((await retry.reconcile('recover', 'server-b')).unlockedIds).toEqual(
      [],
    );
  });

  it('does not award for an invalid guess', async () => {
    const gameplay = new WordleGlobalGameplayService(
      testDb.db,
      () => null,
      () => now,
    );
    let awardCalls = 0;
    const service = new WordleGlobalGameCoordinator(gameplay, {
      checkAndAward: async () => {
        awardCalls++;
        return { unlockedIds: [] };
      },
      getOverview: async () => {
        throw new Error('not expected');
      },
    });
    expect(
      await service.submitGuess('invalid', 'server-a', date, 'bad'),
    ).toEqual({
      error: 'Palavra não encontrada na lista de palavras válidas.',
    });
    expect(awardCalls).toBe(0);
  });
});
