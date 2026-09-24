import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test';

const { MatchRoom } = await import('../../src/realtime/MatchRoom');
const { bootColyseusTestServer, nextMessage, unparsedMessages } =
  await import('../helpers/colyseusTestServer');
const { mintWsSessionToken } =
  await import('../../src/services/activity/wsSessionToken');
const { roomKey } = await import('services/activity/roomKey');
const bingo = await import('@marquinhos/contracts/activity/games/bingoSpeed');

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
    game: 'bingo-speed',
    roomId: 'BINGO',
  } as const;
  return { token: mintWsSessionToken(identity), roomKey: roomKey(identity) };
}

describe('bingo-speed protocol', () => {
  it('sends only messages the bingo-speed protocol describes', async () => {
    const a = creds('user-a');
    const room = await colyseus.createRoom('match', {
      roomKey: a.roomKey,
      game: 'bingo-speed',
    });
    const clientA = await colyseus.connectTo(room, a);
    await nextMessage(clientA, 'init');
    const clientB = await colyseus.connectTo(room, creds('user-b'));
    await nextMessage(clientB, 'init');
    await nextMessage(clientA, 'game_started');

    clientA.send('claim_bingo');
    const claim = await nextMessage(clientA, 'bingo_claim_result');
    expect(claim).toEqual({ error: expect.any(String) });

    expect(
      unparsedMessages([clientA, clientB], bingo.serverMessageSchema),
    ).toEqual([]);
  });
});
