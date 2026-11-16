import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  spyOn,
} from 'bun:test';
import { randomUUID } from 'node:crypto';
import { testRoomDependencies } from '../helpers/realtimeTestDependencies';

const { createMatchRoom } = await import('../../src/realtime/MatchRoom');
const { bootColyseusTestServer, nextMessage, unparsedMessages, waitUntil } =
  await import('../helpers/colyseusTestServer');
const { mintWsSessionToken } = await import('../helpers/wsSessionTokens');
const { roomKey } = await import('modules/activity/room-key');
const wordle = await import('@marquinhos/contracts/activity/games/wordle');

type ColyseusTestServer = import('@colyseus/testing').ColyseusTestServer;
let colyseus: ColyseusTestServer;

beforeAll(async () => {
  colyseus = await bootColyseusTestServer((server) => {
    server
      .define('match', createMatchRoom(testRoomDependencies))
      .filterBy(['roomKey']);
  });
});
afterEach(async () => {
  await colyseus.cleanup();
});
afterAll(async () => {
  await colyseus.shutdown();
});

describe('wordle protocol', () => {
  it('keeps a reopened session playable when an earlier Wordle reservation expires', async () => {
    const identity = {
      userId: `expiry-${randomUUID()}`,
      instanceId: 'expiry-inst',
      guildId: `guild-${randomUUID()}`,
      guildMembershipVerified: true,
      mode: 'single',
      game: 'wordle',
    } as const;
    const key = roomKey(identity);
    const room = await colyseus.createRoom('match', {
      roomKey: key,
      game: 'wordle',
    });
    const oldClient = await colyseus.connectTo(room, {
      token: mintWsSessionToken(identity),
      roomKey: key,
    });
    await nextMessage(oldClient, 'init');
    let expire!: () => void;
    const reservation = new Promise<never>((_, reject) => {
      expire = () => reject(new Error('expired'));
    });
    const reservationSpy = spyOn(
      room,
      'allowReconnection',
    ).mockImplementationOnce(() => reservation as never);
    const leaveSpy = spyOn(room, 'onLeave');
    oldClient.reconnection.enabled = false;
    oldClient.connection.close(4010);
    await waitUntil(() => reservationSpy.mock.calls.length === 1);
    const newClient = await colyseus.connectTo(room, {
      token: mintWsSessionToken(identity),
      roomKey: key,
    });
    const initial = await nextMessage<{ date: string }>(newClient, 'init');
    expire();
    await waitUntil(() => leaveSpy.mock.calls.length === 1);
    newClient.send('wordle_sync');
    const synced = await nextMessage<{ date: string; syncOnly: boolean }>(
      newClient,
      'init',
      (message) => message.syncOnly === true,
    );
    expect(synced.date).toBe(initial.date);
    const members = (
      room as unknown as {
        members: Array<{ userId: string; connections: number }>;
      }
    ).members;
    expect(
      members.find((member) => member.userId === identity.userId)?.connections,
    ).toBe(1);
    const day = await testRoomDependencies.wordle.getDailyWord(
      identity.guildId,
    );
    newClient.send('guess', {
      date: initial.date,
      guess: day.word,
      requestId: randomUUID(),
    });
    expect(
      await nextMessage<{ solved: boolean; attempts: number }>(
        newClient,
        'guess_result',
      ),
    ).toMatchObject({ solved: true, attempts: 1 });
    reservationSpy.mockRestore();
    leaveSpy.mockRestore();
  }, 7_000);

  it('restores an earlier guess made by another connection and then accepts a win', async () => {
    const identity = {
      userId: `shared-miss-${randomUUID()}`,
      instanceId: 'shared-miss-inst',
      guildId: `guild-${randomUUID()}`,
      guildMembershipVerified: true,
      mode: 'single',
      game: 'wordle',
    } as const;
    const key = roomKey(identity);
    const room = await colyseus.createRoom('match', {
      roomKey: key,
      game: 'wordle',
    });
    const first = await colyseus.connectTo(room, {
      token: mintWsSessionToken(identity),
      roomKey: key,
    });
    const second = await colyseus.connectTo(room, {
      token: mintWsSessionToken(identity),
      roomKey: key,
    });
    const initial = await nextMessage<{ date: string }>(second, 'init');
    const day = await testRoomDependencies.wordle.getDailyWord(
      identity.guildId,
    );
    const wrong = [...testRoomDependencies.wordBank.getValidationSet()].find(
      (word) =>
        word.length === day.word.length &&
        word !== day.word &&
        word.normalize('NFD').replace(/\p{Diacritic}/gu, '') !==
          day.word.normalize('NFD').replace(/\p{Diacritic}/gu, ''),
    );
    if (!wrong) throw new Error('Missing alternate valid guess');
    first.send('guess', {
      guess: wrong,
      date: initial.date,
      requestId: randomUUID(),
    });
    expect(
      await nextMessage<{ solved: boolean }>(first, 'guess_result'),
    ).toMatchObject({ solved: false });
    second.send('guess', {
      guess: wrong,
      date: initial.date,
      requestId: randomUUID(),
    });
    await nextMessage(second, 'guess_error');
    const updated = await nextMessage<{
      solved: boolean;
      attempts: number;
      guesses: Array<{ guess: string }>;
      syncOnly?: boolean;
    }>(second, 'init', (message) => message.syncOnly === true);
    expect(updated).toMatchObject({
      solved: false,
      attempts: 1,
      guesses: [{ guess: wrong }],
    });
    second.send('guess', {
      guess: day.word,
      date: initial.date,
      requestId: randomUUID(),
    });
    expect(
      await nextMessage<{ solved: boolean; attempts: number }>(
        second,
        'guess_result',
      ),
    ).toMatchObject({ solved: true, attempts: 2 });
  }, 7_000);

  it('refreshes an outdated board when another connection has already won', async () => {
    const identity = {
      userId: `shared-${randomUUID()}`,
      instanceId: 'shared-inst',
      guildId: `guild-${randomUUID()}`,
      guildMembershipVerified: true,
      mode: 'single',
      game: 'wordle',
    } as const;
    const key = roomKey(identity);
    const room = await colyseus.createRoom('match', {
      roomKey: key,
      game: 'wordle',
    });
    const first = await colyseus.connectTo(room, {
      token: mintWsSessionToken(identity),
      roomKey: key,
    });
    const second = await colyseus.connectTo(room, {
      token: mintWsSessionToken(identity),
      roomKey: key,
    });
    const initial = await nextMessage<{ date: string }>(second, 'init');
    const day = await testRoomDependencies.wordle.getDailyWord(
      identity.guildId,
    );
    first.send('guess', {
      guess: day.word,
      date: initial.date,
      requestId: randomUUID(),
    });
    expect(
      await nextMessage<{ solved: boolean }>(first, 'guess_result'),
    ).toMatchObject({ solved: true });
    second.send('guess', {
      guess: day.word,
      date: initial.date,
      requestId: randomUUID(),
    });
    await nextMessage(second, 'guess_error');
    const updated = await nextMessage<{
      date: string;
      solved: boolean;
      attempts: number;
      syncOnly?: boolean;
    }>(second, 'init', (message) => message.syncOnly === true);
    expect(updated).toMatchObject({
      date: initial.date,
      solved: true,
      attempts: 1,
    });
  }, 7_000);

  it('does not remove an active connection when an old Wordle reservation expires after switching games', async () => {
    const base = {
      instanceId: 'expiry-inst',
      guildId: `guild-${randomUUID()}`,
      roomId: 'EXPIRY',
      mode: 'multi',
      game: 'wordle',
    } as const;
    const host = { ...base, userId: 'host' };
    const guest = { ...base, userId: 'guest' };
    const key = roomKey(host);
    const room = await colyseus.createRoom('match', {
      roomKey: key,
      game: 'wordle',
    });
    const hostClient = await colyseus.connectTo(room, {
      token: mintWsSessionToken(host),
      roomKey: key,
    });
    const dropped = await colyseus.connectTo(room, {
      token: mintWsSessionToken(guest),
      roomKey: key,
    });
    await colyseus.connectTo(room, {
      token: mintWsSessionToken(guest),
      roomKey: key,
    });
    await nextMessage(dropped, 'init');
    let expire!: () => void;
    const reservation = new Promise<never>((_, reject) => {
      expire = () => reject(new Error('expired'));
    });
    const reservationSpy = spyOn(
      room,
      'allowReconnection',
    ).mockImplementationOnce(() => reservation as never);
    const leaveSpy = spyOn(room, 'onLeave');
    dropped.reconnection.enabled = false;
    dropped.connection.close(4010);
    await waitUntil(() => reservationSpy.mock.calls.length === 1);
    hostClient.send('switch_game', { game: 'connect-four' });
    await nextMessage<{ game: string }>(
      hostClient,
      'room_state',
      (message) => message.game === 'connect-four',
    );
    expire();
    await waitUntil(() => leaveSpy.mock.calls.length === 1);
    const members = (
      room as unknown as {
        members: Array<{ userId: string; connections: number }>;
      }
    ).members;
    expect(
      members.find((member) => member.userId === 'guest')?.connections,
    ).toBe(1);
    reservationSpy.mockRestore();
    leaveSpy.mockRestore();
  }, 7_000);

  it('restores a dropped Wordle player if the host switches games before reconnection', async () => {
    const base = {
      instanceId: 'switch-inst',
      guildId: `guild-${randomUUID()}`,
      roomId: 'SWITCH',
      mode: 'multi',
      game: 'wordle',
    } as const;
    const host = { ...base, userId: 'host' };
    const guest = { ...base, userId: 'guest' };
    const key = roomKey(host);
    const room = await colyseus.createRoom('match', {
      roomKey: key,
      game: 'wordle',
    });
    const hostClient = await colyseus.connectTo(room, {
      token: mintWsSessionToken(host),
      roomKey: key,
    });
    const guestClient = await colyseus.connectTo(room, {
      token: mintWsSessionToken(guest),
      roomKey: key,
    });
    await nextMessage(guestClient, 'init');
    guestClient.reconnection.minUptime = 0;
    const reconnected = new Promise<void>((resolve) =>
      guestClient.onReconnect(() => resolve()),
    );
    guestClient.connection.close(4010);
    await waitUntil(() => room.clients.length === 1);
    hostClient.send('switch_game', { game: 'connect-four' });
    await nextMessage<{ game: string }>(
      hostClient,
      'room_state',
      (message) => message.game === 'connect-four',
    );
    await Promise.race([
      reconnected,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Reconnect timed out')), 3_000),
      ),
    ]);
    const state = await nextMessage<{
      game: string;
      members: Array<{ userId: string }>;
    }>(guestClient, 'room_state', (message) => message.game === 'connect-four');
    expect(state.members.map((member) => member.userId)).toContain('guest');
    await nextMessage(
      guestClient,
      'init',
      (message) =>
        typeof message === 'object' && message !== null && 'disc' in message,
    );
  }, 7_000);

  it('reconnects after a network drop and resynchronizes the board', async () => {
    const identity = {
      userId: `reconnect-${randomUUID()}`,
      instanceId: 'reconnect-inst',
      guildId: `guild-${randomUUID()}`,
      guildMembershipVerified: true,
      mode: 'single',
      game: 'wordle',
    } as const;
    const key = roomKey(identity);
    const room = await colyseus.createRoom('match', {
      roomKey: key,
      game: 'wordle',
    });
    const client = await colyseus.connectTo(room, {
      token: mintWsSessionToken(identity),
      roomKey: key,
    });
    const otherClient = await colyseus.connectTo(room, {
      token: mintWsSessionToken(identity),
      roomKey: key,
    });
    const initial = await nextMessage<{ date: string }>(client, 'init');
    const oldServerClient = room.clients.find(
      (item: { sessionId: string }) => item.sessionId === client.sessionId,
    );
    client.send('wordle_sync');
    await nextMessage<{ syncOnly: boolean }>(
      client,
      'init',
      (message) => message.syncOnly === true,
    );
    client.reconnection.minUptime = 0;
    client.reconnection.maxRetries = 3;
    const reconnected = new Promise<void>((resolve) =>
      client.onReconnect(() => resolve()),
    );
    client.connection.close(4010);
    await Promise.race([
      reconnected,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Reconnect timed out')), 3_000),
      ),
    ]);
    const limiters = (
      room as unknown as {
        rateLimiters: Map<string, { state: Map<object, unknown> }>;
      }
    ).rateLimiters;
    expect(
      [...limiters.values()].some((limiter) =>
        limiter.state.has(oldServerClient!),
      ),
    ).toBe(false);
    client.send('wordle_sync');
    expect(
      await nextMessage<{ date: string; syncOnly: boolean }>(
        client,
        'init',
        (message) => message.syncOnly === true,
      ),
    ).toMatchObject({ date: initial.date, syncOnly: true });
    const members = (
      room as unknown as {
        members: Array<{ userId: string; connections: number }>;
      }
    ).members;
    expect(
      members.find((member) => member.userId === identity.userId)?.connections,
    ).toBe(2);
    await client.leave();
    await waitUntil(
      () =>
        members.find((member) => member.userId === identity.userId)
          ?.connections === 1,
    );
    otherClient.send('wordle_sync');
    expect(
      await nextMessage<{ date: string; syncOnly: boolean }>(
        otherClient,
        'init',
        (message) => message.syncOnly === true,
      ),
    ).toMatchObject({ date: initial.date, syncOnly: true });
  }, 6_000);

  it('resends initialization on request after the client attaches its listener', async () => {
    const identity = {
      userId: `sync-${randomUUID()}`,
      instanceId: 'sync-inst',
      guildId: `guild-${randomUUID()}`,
      guildMembershipVerified: true,
      mode: 'single',
      game: 'wordle',
    } as const;
    const key = roomKey(identity);
    const room = await colyseus.createRoom('match', {
      roomKey: key,
      game: 'wordle',
    });
    const client = await colyseus.connectTo(room, {
      token: mintWsSessionToken(identity),
      roomKey: key,
    });
    const first = await nextMessage<{ date: string }>(client, 'init');
    client.send('wordle_sync');
    const synced = await nextMessage<{ date: string; syncOnly: boolean }>(
      client,
      'init',
    );
    expect(synced).toMatchObject({ date: first.date, syncOnly: true });
    expect(unparsedMessages([client], wordle.serverMessageSchema)).toEqual([]);
  });
  it('saves realtime draft updates with optimistic revisions and no correctness signal', async () => {
    const identity = {
      userId: 'draft-user',
      instanceId: 'draft-inst',
      guildId: `guild-${randomUUID()}`,
      guildMembershipVerified: true,
      mode: 'single',
      game: 'wordle',
    } as const;
    const key = roomKey(identity);
    const room = await colyseus.createRoom('match', {
      roomKey: key,
      game: 'wordle',
    });
    const client = await colyseus.connectTo(room, {
      token: mintWsSessionToken(identity),
      roomKey: key,
    });
    const init = await nextMessage<{ wordLength: number; date: string }>(
      client,
      'init',
    );
    const payload = {
      date: init.date,
      rowIndex: 0,
      cells: Array(init.wordLength).fill(''),
      activeIndex: 2,
      expectedRevision: 0,
      requestId: 1,
    };

    client.send('draft_update', payload);
    const saved = await nextMessage<{
      status: string;
      requestId: number;
      draft: {
        date: string;
        rowIndex: number;
        cells: string[];
        activeIndex: number;
        revision: number;
      };
    }>(client, 'draft_result');
    expect(saved).toEqual({
      status: 'saved',
      requestId: 1,
      draft: {
        date: init.date,
        rowIndex: 0,
        cells: payload.cells,
        activeIndex: 2,
        revision: 1,
      },
    });
    expect(saved).not.toHaveProperty('correct');

    client.send('draft_update', {
      ...payload,
      cells: Array(init.wordLength).fill('a'),
      requestId: 2,
    });
    const conflict = await nextMessage<{
      status: string;
      requestId: number;
      draft: { revision: number };
    }>(client, 'draft_result');
    expect(conflict).toEqual({
      status: 'conflict',
      draft: saved.draft,
      requestId: 2,
    });
    expect(unparsedMessages([client], wordle.serverMessageSchema)).toEqual([]);
  });

  it('sends only messages the wordle protocol describes', async () => {
    const identity = {
      userId: `user-${randomUUID()}`,
      instanceId: 'inst-1',
      guildId: `guild-${randomUUID()}`,
      guildMembershipVerified: true,
      mode: 'single',
      game: 'wordle',
    } as const;
    const key = roomKey(identity);
    const room = await colyseus.createRoom('match', {
      roomKey: key,
      game: 'wordle',
    });
    const client = await colyseus.connectTo(room, {
      token: mintWsSessionToken(identity),
      roomKey: key,
    });
    const init = await nextMessage<{ wordLength: number }>(client, 'init');
    const guess =
      [...testRoomDependencies.wordBank.getValidationSet()].find(
        (word) => word.length === init.wordLength,
      ) ?? '';

    client.send('guess', { guess: 'x' });
    await nextMessage(client, 'guess_error');
    client.send('guess', { guess });
    await nextMessage(client, 'guess_result');

    expect(unparsedMessages([client], wordle.serverMessageSchema)).toEqual([]);
  });
});
