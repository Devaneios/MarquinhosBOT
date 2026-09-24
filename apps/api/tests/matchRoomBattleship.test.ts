import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test';

const { MatchRoom } = await import('../src/realtime/MatchRoom');
const { bootColyseusTestServer, nextMessage } =
  await import('./helpers/colyseusTestServer');
const { mintWsSessionToken } =
  await import('../src/services/activity/wsSessionToken');
const { roomKey } = await import('services/activity/roomKey');

type ColyseusTestServer = import('@colyseus/testing').ColyseusTestServer;

let colyseus: ColyseusTestServer;

beforeAll(async () => {
  colyseus = await bootColyseusTestServer((server) => {
    server.define('match', MatchRoom).filterBy(['roomKey']);
  });
});

afterEach(async () => {
  if (colyseus) await colyseus.cleanup();
});

afterAll(async () => {
  if (colyseus) await colyseus.shutdown();
});

function sessionFor(userId: string, roomId: string) {
  const identity = {
    userId,
    instanceId: 'inst-1',
    guildId: 'guild-1',
    mode: 'multi',
    game: 'battleship',
    roomId,
  } as const;
  return { token: mintWsSessionToken(identity), roomKey: roomKey(identity) };
}

describe('MatchRoom · battleship', () => {
  it('seats the first joiner on a side', async () => {
    const session = sessionFor('user-a', 'ROOM01');
    const room = await colyseus.createRoom('match', {
      game: 'battleship',
      roomKey: session.roomKey,
    });
    const client = await colyseus.connectTo(room, session);
    const init = await nextMessage<{ side: unknown }>(client, 'init');

    expect(init.side).toBeTruthy();
  });

  it('rejects a join with an invalid session token', async () => {
    const { roomKey: key } = sessionFor('user-a', 'ROOM01');
    const room = await colyseus.createRoom('match', {
      game: 'battleship',
      roomKey: key,
    });

    await expect(
      colyseus.connectTo(room, { token: 'garbage', roomKey: key }),
    ).rejects.toBeTruthy();
  });

  it('rejects a join whose roomKey does not match its token identity', async () => {
    const other = sessionFor('user-a', 'ROOM02');
    const room = await colyseus.createRoom('match', {
      game: 'battleship',
      roomKey: other.roomKey,
    });

    await expect(
      colyseus.connectTo(room, {
        token: sessionFor('user-a', 'ROOM01').token,
        roomKey: other.roomKey,
      }),
    ).rejects.toBeTruthy();
  });
});
