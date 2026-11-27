import { serverMessageSchema } from '@marquinhos/contracts/activity/games/wordle';
import {
  achievements,
  userLevels,
  wordleGlobalAcceptedGuesses,
  wordleGlobalAchievements,
  wordleGlobalDays,
} from '@marquinhos/database/schema';
import { createTestDb, type TestDb } from '@marquinhos/database/testing';
import { afterAll, beforeAll, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import { roomKey } from '../../src/modules/activity/room-key';
import { getRecifeDate } from '../../src/modules/wordle/wordle-date';
import { createMatchRoom } from '../../src/realtime/MatchRoom';
import {
  bootColyseusTestServer,
  nextMessage,
} from '../helpers/colyseusTestServer';
import { createRealtimeTestDependencies } from '../helpers/realtimeTestDependencies';
import { createWordleTestServices } from '../helpers/wordleServices';
import { mintWsSessionToken } from '../helpers/wsSessionTokens';

let database: TestDb;
beforeAll(async () => {
  database = await createTestDb();
});

it('replays a saved guess after midnight before loading the new board', async () => {
  const day = '2026-11-01';
  const nextDay = '2026-11-02';
  let clock = Date.parse('2026-11-01T15:00:00Z');
  let today = day;
  await database.db
    .insert(wordleGlobalDays)
    .values([
      { word_date: day, word: 'termo', word_length: 5, created_at: 1 },
      { word_date: nextDay, word: 'carta', word_length: 5, created_at: 1 },
    ])
    .onConflictDoNothing();
  await database.db
    .insert(achievements)
    .values({
      id: 'wordle_v2_solved_exactly_1',
      name: 'Palpite certeiro',
      description: 'Acerte de primeira',
      category: 'wordle',
      rarity: 'epic',
      icon: 'x',
      reward_xp: 150,
    })
    .onConflictDoNothing();
  const services = createWordleTestServices(database.db, {
    now: () => clock,
    today: () => today,
  });
  const dependencies = {
    ...createRealtimeTestDependencies(database.db),
    wordle: services.wordle,
  };
  const server = await bootColyseusTestServer((instance) =>
    instance
      .define('match', createMatchRoom(dependencies))
      .filterBy(['roomKey']),
  );
  try {
    const identity = {
      userId: 'midnight-protocol-player',
      instanceId: 'midnight-instance',
      guildId: 'midnight-guild',
      guildMembershipVerified: true,
      mode: 'single',
      game: 'wordle',
    } as const;
    const key = roomKey(identity);
    const room = await server.createRoom('match', {
      roomKey: key,
      game: 'wordle',
    });
    const client = await server.connectTo(room, {
      token: mintWsSessionToken(identity),
      roomKey: key,
    });
    await nextMessage(client, 'init');
    const requestId = '7e934f2b-a691-4c08-94f4-d82df6968b27';
    client.send('guess', {
      guess: 'termo',
      date: day,
      requestId,
      captureAchievementBaseline: true,
    });
    await nextMessage(client, 'guess_result');
    clock += 86_400_000;
    today = nextDay;
    client.send('guess', {
      guess: 'termo',
      date: day,
      requestId,
      captureAchievementBaseline: true,
    });
    const replay = serverMessageSchema.parse({
      type: 'guess_result',
      payload: await nextMessage(client, 'guess_result'),
    });
    if (replay.type !== 'guess_result') throw new Error('Unexpected message');
    expect(replay.payload).toMatchObject({
      solved: true,
      attempts: 1,
      requestId,
      achievementBaseline: [],
    });
    const init = serverMessageSchema.parse({
      type: 'init',
      payload: await nextMessage(client, 'init'),
    });
    if (init.type !== 'init') throw new Error('Unexpected message');
    expect(init.payload).toMatchObject({
      date: nextDay,
      solved: false,
      guesses: [],
    });
    client.send('guess', {
      guess: 'termo',
      date: day,
      requestId: '9e934f2b-a691-4c08-94f4-d82df6968b27',
    });
    await nextMessage(client, 'init');
    const stale = await nextMessage<{ message: string }>(client, 'guess_error');
    expect(stale.message).toContain('dia do jogo mudou');
    expect(
      await database.db
        .select()
        .from(wordleGlobalAcceptedGuesses)
        .where(eq(wordleGlobalAcceptedGuesses.user_id, identity.userId)),
    ).toHaveLength(1);
    const [level] = await database.db
      .select()
      .from(userLevels)
      .where(eq(userLevels.user_id, identity.userId));
    expect(level?.total_xp).toBe(150);
  } finally {
    await server.shutdown();
  }
});

it('refreshes an open session after a failed award is recovered by the background job', async () => {
  const date = getRecifeDate();
  await database.db
    .insert(wordleGlobalDays)
    .values({ word_date: date, word: 'termo', word_length: 5, created_at: 1 })
    .onConflictDoNothing();
  await database.db
    .insert(achievements)
    .values({
      id: 'wordle_v2_solved_exactly_1',
      name: 'Palpite certeiro',
      description: 'Acerte de primeira',
      category: 'wordle',
      rarity: 'epic',
      icon: 'x',
      reward_xp: 150,
    })
    .onConflictDoNothing();
  await database.db
    .insert(achievements)
    .values({
      id: 'wordle_v2_solved_exactly_2',
      name: 'Dois',
      description: 'Antiga',
      category: 'wordle',
      rarity: 'rare',
      icon: 'x',
      reward_xp: 0,
    })
    .onConflictDoNothing();
  await database.db.insert(wordleGlobalAchievements).values({
    user_id: 'recovered-protocol-player',
    achievement_id: 'wordle_v2_solved_exactly_2',
    unlocked_at: Date.now() - 100_000,
  });
  const services = createWordleTestServices(database.db);
  const realRefresh = services.wordle.refreshAchievements.bind(services.wordle);
  services.wordle.refreshAchievements = async () => {
    throw new Error('overview unavailable');
  };
  const dependencies = {
    ...createRealtimeTestDependencies(database.db),
    wordle: services.wordle,
  };
  const server = await bootColyseusTestServer((instance) =>
    instance
      .define('match', createMatchRoom(dependencies))
      .filterBy(['roomKey']),
  );
  try {
    const identity = {
      userId: 'recovered-protocol-player',
      instanceId: 'recovery-instance',
      guildId: 'recovery-guild',
      guildMembershipVerified: true,
      mode: 'single',
      game: 'wordle',
    } as const;
    const key = roomKey(identity);
    const room = await server.createRoom('match', {
      roomKey: key,
      game: 'wordle',
    });
    const client = await server.connectTo(room, {
      token: mintWsSessionToken(identity),
      roomKey: key,
    });
    const firstInit = serverMessageSchema.parse({
      type: 'init',
      payload: await nextMessage(client, 'init'),
    });
    if (firstInit.type !== 'init') throw new Error('Unexpected message');
    expect(firstInit.payload.achievementOverview).toBeUndefined();
    services.wordle.refreshAchievements = realRefresh;
    const realAward = services.globalAchievements.checkAndAward.bind(
      services.globalAchievements,
    );
    services.globalAchievements.checkAndAward = async () => {
      throw new Error('temporary failure');
    };
    client.send('guess', {
      guess: 'termo',
      date,
      captureAchievementBaseline: true,
    });
    const guess = serverMessageSchema.parse({
      type: 'guess_result',
      payload: await nextMessage(client, 'guess_result'),
    });
    if (guess.type !== 'guess_result') throw new Error('Unexpected message');
    expect(guess.payload.solved).toBe(true);
    expect(guess.payload.achievementBaseline).toEqual([
      'wordle_v2_solved_exactly_2',
    ]);
    expect(guess.payload.achievementUpdate).toBeUndefined();

    client.send('achievement_refresh', { requestId: 1 });
    const pendingPayload = await nextMessage(
      client,
      'achievement_refresh_result',
    );
    const pending = serverMessageSchema.parse({
      type: 'achievement_refresh_result',
      payload: pendingPayload,
    });
    if (pending.type !== 'achievement_refresh_result')
      throw new Error('Unexpected message');
    expect(pending.payload.pending).toBe(true);
    expect(
      pending.payload.overview.achievements.find(
        (item) => item.id === 'wordle_v2_solved_exactly_1',
      )?.unlockedAt,
    ).toBeNull();

    const reconnecting = await server.connectTo(room, {
      token: mintWsSessionToken(identity),
      roomKey: key,
    });
    const init = serverMessageSchema.parse({
      type: 'init',
      payload: await nextMessage(reconnecting, 'init'),
    });
    if (init.type !== 'init') throw new Error('Unexpected message');
    expect(init.payload.achievementPending).toBe(true);

    services.globalAchievements.checkAndAward = realAward;
    await services.globalCoordinator.reconcilePending();
    client.send('achievement_refresh', { requestId: 2 });
    const recoveredPayload = await nextMessage(
      client,
      'achievement_refresh_result',
    );
    const recovered = serverMessageSchema.parse({
      type: 'achievement_refresh_result',
      payload: recoveredPayload,
    });
    if (recovered.type !== 'achievement_refresh_result')
      throw new Error('Unexpected message');
    expect(recovered.payload.pending).toBe(false);
    expect(
      recovered.payload.overview.achievements.find(
        (item) => item.id === 'wordle_v2_solved_exactly_1',
      )?.unlockedAt,
    ).toEqual(expect.any(String));
    const [level] = await database.db
      .select()
      .from(userLevels)
      .where(eq(userLevels.user_id, identity.userId));
    expect(level?.total_xp).toBe(150);
  } finally {
    await server.shutdown();
  }
});
afterAll(async () => {
  await database.drop();
});

it('persists an earned achievement and restores it on reconnect through the Wordle protocol', async () => {
  const date = getRecifeDate();
  await database.db
    .insert(wordleGlobalDays)
    .values({ word_date: date, word: 'termo', word_length: 5, created_at: 1 })
    .onConflictDoNothing();
  await database.db
    .insert(achievements)
    .values({
      id: 'wordle_v2_solved_exactly_1',
      name: 'Palpite certeiro',
      description: 'Acerte de primeira',
      category: 'wordle',
      rarity: 'epic',
      icon: 'x',
      reward_xp: 150,
    })
    .onConflictDoNothing();
  const dependencies = createRealtimeTestDependencies(database.db);
  const server = await bootColyseusTestServer((instance) =>
    instance
      .define('match', createMatchRoom(dependencies))
      .filterBy(['roomKey']),
  );
  try {
    const identity = {
      userId: 'protocol-achiever',
      instanceId: 'protocol-instance',
      guildId: 'protocol-guild',
      guildMembershipVerified: true,
      mode: 'single',
      game: 'wordle',
    } as const;
    const key = roomKey(identity);
    const room = await server.createRoom('match', {
      roomKey: key,
      game: 'wordle',
    });
    const client = await server.connectTo(room, {
      token: mintWsSessionToken(identity),
      roomKey: key,
    });
    await nextMessage(client, 'init');
    const requestId = '3e934f2b-a691-4c08-94f4-d82df6968b27';
    client.send('guess', {
      guess: 'termo',
      date,
      requestId,
      captureAchievementBaseline: true,
    });
    const payload = await nextMessage(client, 'guess_result');
    const result = serverMessageSchema.parse({ type: 'guess_result', payload });
    if (result.type !== 'guess_result') throw new Error('Unexpected message');
    expect(result.payload).toMatchObject({
      solved: true,
      achievementUpdate: { unlockedIds: ['wordle_v2_solved_exactly_1'] },
    });
    client.send('guess', {
      guess: 'termo',
      date,
      requestId,
      captureAchievementBaseline: true,
    });
    const replay = serverMessageSchema.parse({
      type: 'guess_result',
      payload: await nextMessage(client, 'guess_result'),
    });
    if (replay.type !== 'guess_result') throw new Error('Unexpected message');
    expect(replay.payload).toMatchObject({
      requestId,
      solved: true,
      attempts: 1,
      achievementBaseline: [],
    });
    expect(
      result.payload.achievementUpdate?.overview.achievements.find(
        (item) => item.id === 'wordle_v2_solved_exactly_1',
      )?.unlockedAt,
    ).toEqual(expect.any(String));
    expect(
      await database.db
        .select()
        .from(wordleGlobalAchievements)
        .where(eq(wordleGlobalAchievements.user_id, identity.userId)),
    ).toHaveLength(1);
    const [level] = await database.db
      .select()
      .from(userLevels)
      .where(eq(userLevels.user_id, identity.userId));
    expect(level).toMatchObject({ guild_id: identity.guildId, total_xp: 150 });

    const reconnected = await server.connectTo(room, {
      token: mintWsSessionToken(identity),
      roomKey: key,
    });
    const initPayload = await nextMessage(reconnected, 'init');
    const init = serverMessageSchema.parse({
      type: 'init',
      payload: initPayload,
    });
    if (init.type !== 'init') throw new Error('Unexpected message');
    expect(init.payload.solved).toBe(true);
    expect(
      init.payload.achievementOverview?.achievements.find(
        (item) => item.id === 'wordle_v2_solved_exactly_1',
      )?.unlockedAt,
    ).toEqual(expect.any(String));
    const [afterReconnect] = await database.db
      .select()
      .from(userLevels)
      .where(eq(userLevels.user_id, identity.userId));
    expect(afterReconnect?.total_xp).toBe(150);
  } finally {
    await server.shutdown();
  }
});
