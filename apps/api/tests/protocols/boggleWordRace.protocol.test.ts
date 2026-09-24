import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test';

const { MatchRoom } = await import('../../src/realtime/MatchRoom');
const { bootColyseusTestServer, nextMessage, unparsedMessages } =
  await import('../helpers/colyseusTestServer');
const { mintWsSessionToken } =
  await import('../../src/services/activity/wsSessionToken');
const { roomKey } = await import('services/activity/roomKey');
const boggle =
  await import('@marquinhos/contracts/activity/games/boggleWordRace');

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
    game: 'boggle-word-race',
    roomId: 'BOGGLE',
  } as const;
  return { token: mintWsSessionToken(identity), roomKey: roomKey(identity) };
}

describe('boggle-word-race protocol', () => {
  it('sends only messages the boggle protocol describes', async () => {
    const a = creds('user-a');
    const room = await colyseus.createRoom('match', {
      roomKey: a.roomKey,
      game: 'boggle-word-race',
    });
    const clientA = await colyseus.connectTo(room, a);
    const clientB = await colyseus.connectTo(room, creds('user-b'));
    await nextMessage(clientA, 'init');
    await nextMessage(clientB, 'init');

    clientA.send('submit_word', { path: [] });
    await nextMessage(clientA, 'submit_error');
    clientA.send('submit_word', {
      path: [
        { row: 0, col: 0 },
        { row: 0, col: 1 },
      ],
    });
    await nextMessage(clientA, 'submit_error');

    expect(
      unparsedMessages([clientA, clientB], boggle.serverMessageSchema),
    ).toEqual([]);
  });
});
