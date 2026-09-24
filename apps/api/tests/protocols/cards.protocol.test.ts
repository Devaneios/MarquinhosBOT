import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test';

const { MatchRoom } = await import('../../src/realtime/MatchRoom');
const { bootColyseusTestServer, nextMessage, unparsedMessages } =
  await import('../helpers/colyseusTestServer');
const { mintWsSessionToken } =
  await import('../../src/services/activity/wsSessionToken');
const { roomKey } = await import('../../src/services/activity/roomKey');
const cards = await import('@marquinhos/contracts/activity/games/cards');

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
    game: 'cards',
    roomId: 'TRUCO',
    ruleset: 'truco-1v1',
  } as const;
  return { token: mintWsSessionToken(identity), roomKey: roomKey(identity) };
}

describe('cards protocol', () => {
  it('sends only messages the cards protocol describes', async () => {
    const a = creds('user-a');
    const room = await colyseus.createRoom('match', {
      game: 'cards',
      roomKey: a.roomKey,
      token: a.token,
    });
    const clientA = await colyseus.connectTo(room, a);
    const clientB = await colyseus.connectTo(room, creds('user-b'));
    await nextMessage(clientA, 'init');
    await nextMessage(clientB, 'init');
    const state = await nextMessage(clientA, 'state');
    expect(cards.trucoViewSchema.safeParse(state).success).toBe(true);

    clientA.send('move', { move: 'no-such-move' });
    const rejected = await nextMessage(clientA, 'move_rejected');
    expect(rejected).toEqual({ reason: expect.any(String) });

    expect(
      unparsedMessages([clientA, clientB], cards.serverMessageSchema),
    ).toEqual([]);
  });
});
