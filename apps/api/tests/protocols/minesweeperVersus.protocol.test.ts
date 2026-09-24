import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test';

const { MatchRoom } = await import('../../src/realtime/MatchRoom');
const { bootColyseusTestServer, nextMessage, unparsedMessages } =
  await import('../helpers/colyseusTestServer');
const { mintWsSessionToken } =
  await import('../../src/services/activity/wsSessionToken');
const { roomKey } = await import('services/activity/roomKey');
const minesweeper =
  await import('@marquinhos/contracts/activity/games/minesweeperVersus');

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
    game: 'minesweeper-versus',
    roomId: 'MINES',
  } as const;
  return { token: mintWsSessionToken(identity), roomKey: roomKey(identity) };
}

describe('minesweeper-versus protocol', () => {
  it('sends only messages the minesweeper protocol describes', async () => {
    const a = creds('user-a');
    const room = await colyseus.createRoom('match', {
      roomKey: a.roomKey,
      game: 'minesweeper-versus',
    });
    const clientA = await colyseus.connectTo(room, a);
    await nextMessage(clientA, 'init');
    const clientB = await colyseus.connectTo(room, creds('user-b'));
    await nextMessage(clientB, 'init');

    clientA.send('reveal', { x: 0.5, y: 0 });
    const invalid = await nextMessage(clientA, 'reveal_error');
    expect(invalid).toEqual({ message: 'Invalid tile coordinates' });
    clientA.send('reveal', { x: 0, y: 0 });
    await nextMessage(clientB, 'reveal');
    clientB.send('reveal', { x: 0, y: 0 });
    await nextMessage(clientB, 'reveal_error');

    expect(
      unparsedMessages([clientA, clientB], minesweeper.serverMessageSchema),
    ).toEqual([]);
  });
});
