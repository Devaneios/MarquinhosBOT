import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test';

const { MatchRoom } = await import('../../src/realtime/MatchRoom');
const { bootColyseusTestServer, nextMessage, unparsedMessages } =
  await import('../helpers/colyseusTestServer');
const { mintWsSessionToken } =
  await import('../../src/services/activity/wsSessionToken');
const { roomKey } = await import('../../src/services/activity/roomKey');
const pong = await import('@marquinhos/contracts/activity/games/pong');

type ColyseusTestServer = import('@colyseus/testing').ColyseusTestServer;
let colyseus: ColyseusTestServer;

beforeAll(async () => {
  colyseus = await bootColyseusTestServer((server) => {
    server.define('match', MatchRoom).filterBy(['roomKey']);
  });
});
afterEach(async () => {
  await colyseus.cleanup();
});
afterAll(async () => {
  await colyseus.shutdown();
});

function creds(userId: string) {
  const identity = {
    userId,
    instanceId: 'inst-1',
    guildId: 'guild-1',
    mode: 'multi',
    game: 'pong',
    roomId: 'PONG',
  } as const;
  return { token: mintWsSessionToken(identity), roomKey: roomKey(identity) };
}

describe('pong protocol', () => {
  it('sends only messages the pong protocol describes', async () => {
    const a = creds('user-a');
    const room = await colyseus.createRoom('match', {
      game: 'pong',
      roomKey: a.roomKey,
    });
    const clientA = await colyseus.connectTo(room, a);
    await nextMessage(clientA, 'init');
    const clientB = await colyseus.connectTo(room, creds('user-b'));
    await nextMessage(clientB, 'init');

    clientB.send('sync');
    const synced = await nextMessage(clientB, 'init');
    expect(synced).toMatchObject({
      selfUserId: 'user-b',
      assignment: { slot: 1 },
    });

    clientA.send('lobby_config', { targetScore: 7, ruleset: 'nonsense' });
    const lobby = await nextMessage(
      clientB,
      'lobby_state',
      (payload) =>
        (payload as { config: { targetScore: number } }).config.targetScore ===
        7,
    );
    expect(lobby).toMatchObject({
      config: { ruleset: 'classic-1v1', targetScore: 7 },
    });
    clientA.send('ready', { ready: true });
    clientB.send('ready', { ready: true });
    await nextMessage(clientA, 'state');
    clientA.send('input', { seq: 1, direction: -1 });

    expect(
      unparsedMessages([clientA, clientB], pong.serverMessageSchema),
    ).toEqual([]);
  });
});
