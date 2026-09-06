import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test';

const { Server } = await import('colyseus');
const { WebSocketTransport } = await import('@colyseus/ws-transport');
const { boot } = await import('@colyseus/testing');
const { PongRoom } = await import('../src/realtime/PongRoom');
const { mintWsSessionToken } =
  await import('../src/services/activity/wsSessionToken');
const { roomKey } = await import('../src/services/activity/roomKey');

type ColyseusTestServer = import('@colyseus/testing').ColyseusTestServer;

let colyseus: ColyseusTestServer;

beforeAll(async () => {
  const gameServer = new Server({ transport: new WebSocketTransport() });
  gameServer.define('pong', PongRoom).filterBy(['roomKey']);
  colyseus = await boot(gameServer);
});

afterEach(async () => {
  await colyseus.cleanup();
});

afterAll(async () => {
  await colyseus.shutdown();
});

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sessionFor(
  userId: string,
  mode: 'single' | 'multi' | 'local',
  extra: {
    difficulty?: string;
    winningScore?: number;
    ruleset?: string;
    options?: Record<string, unknown>;
  } = {},
) {
  const instanceId = 'inst-1';
  const game = 'pong' as const;
  const roomId = mode === 'multi' ? 'PONG' : undefined;
  const key = roomKey({
    instanceId,
    game,
    mode,
    userId,
    ...(roomId ? { roomId } : {}),
    ...(extra.ruleset ? { ruleset: extra.ruleset } : {}),
  });
  const token = mintWsSessionToken({
    userId,
    instanceId,
    guildId: 'guild-1',
    mode,
    game,
    ...(roomId ? { roomId } : {}),
    ...extra,
  } as any);
  return { token, roomKey: key };
}

describe('PongRoom', () => {
  it('rejects a join with an invalid session token', async () => {
    const room = await colyseus.createRoom('pong', {
      roomKey: 'inst-1:pong:multi',
    });

    expect(
      colyseus.connectTo(room, {
        token: 'garbage',
        roomKey: 'inst-1:pong:multi',
      }),
    ).rejects.toBeTruthy();
  });

  it('assigns left/right sides to the first two joiners of a multi match', async () => {
    const session = sessionFor('user-a', 'multi');
    const room = await colyseus.createRoom('pong', {
      roomKey: session.roomKey,
      token: session.token,
    });
    const clientA = await colyseus.connectTo(room, session);
    const [, initA] = await clientA.waitForNextMessage();
    expect(initA.side).toBe('left');

    const sessionB = sessionFor('user-b', 'multi');
    const clientB = await colyseus.connectTo(room, sessionB);
    const [, initB] = await clientB.waitForNextMessage();
    expect(initB.side).toBe('right');
  });

  it('admits a third joiner as a spectator with a null side', async () => {
    const room = await colyseus.createRoom('pong', {
      ...sessionFor('user-a', 'multi'),
    });
    await colyseus.connectTo(room, sessionFor('user-a', 'multi'));
    await colyseus.connectTo(room, sessionFor('user-b', 'multi'));
    const spectator = await colyseus.connectTo(
      room,
      sessionFor('user-c', 'multi'),
    );
    const [, init] = await spectator.waitForNextMessage();

    expect(init.side).toBeNull();
  });

  it('starts ticking immediately on a single-player (vs bot) join', async () => {
    const session = sessionFor('user-a', 'single', { difficulty: 'easy' });
    const room = await colyseus.createRoom('pong', {
      roomKey: session.roomKey,
      token: session.token,
    });
    const client = await colyseus.connectTo(room, session);
    await client.waitForNextMessage();

    let stateMessages = 0;
    client.onMessage('state', () => {
      stateMessages += 1;
    });
    await wait(70);

    expect(stateMessages).toBeGreaterThan(0);
  });

  it('does not start a plain multi-mode session on a single join', async () => {
    const session = sessionFor('user-a', 'multi');
    const room = await colyseus.createRoom('pong', {
      roomKey: session.roomKey,
      token: session.token,
    });
    const client = await colyseus.connectTo(room, session);
    await client.waitForNextMessage();

    let stateMessages = 0;
    client.onMessage('state', () => {
      stateMessages += 1;
    });
    await wait(70);

    expect(stateMessages).toBe(0);
  });

  it('forfeits the match to the opponent when a player explicitly leaves', async () => {
    const sessionA = sessionFor('user-a', 'multi');
    const room = await colyseus.createRoom('pong', {
      roomKey: sessionA.roomKey,
      token: sessionA.token,
    });
    const clientA = await colyseus.connectTo(room, sessionA);
    await clientA.waitForNextMessage();
    const clientB = await colyseus.connectTo(
      room,
      sessionFor('user-b', 'multi'),
    );
    await clientB.waitForNextMessage();
    await wait(20);

    clientA.send('ready', { ready: true });
    clientB.send('ready', { ready: true });
    let playerDisconnected = false;
    clientB.onMessage('player_disconnected', () => {
      playerDisconnected = true;
    });

    clientA.send('leave');
    await wait(30);

    expect(playerDisconnected).toBe(false);
  });
});
