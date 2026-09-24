import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test';

const { MatchRoom } = await import('../../src/realtime/MatchRoom');
const { bootColyseusTestServer, nextMessage, unparsedMessages } =
  await import('../helpers/colyseusTestServer');
const { mintWsSessionToken } =
  await import('../../src/services/activity/wsSessionToken');
const { roomKey } = await import('services/activity/roomKey');
const wordleRace =
  await import('@marquinhos/contracts/activity/games/wordleRace');

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
    game: 'wordle-race',
    roomId: 'WORDLERACE',
  } as const;
  return { token: mintWsSessionToken(identity), roomKey: roomKey(identity) };
}

describe('wordle-race protocol', () => {
  it('sends only messages the wordle-race protocol describes', async () => {
    const a = creds('user-a');
    const room = await colyseus.createRoom('match', {
      roomKey: a.roomKey,
      game: 'wordle-race',
    });
    const clientA = await colyseus.connectTo(room, a);
    const clientB = await colyseus.connectTo(room, creds('user-b'));
    await nextMessage(clientA, 'init');
    await nextMessage(
      clientA,
      'player_joined',
      (joined: { userId: string }) => joined.userId === 'user-b',
    );

    clientA.send('guess', { guess: 'abrir' });
    await nextMessage(clientB, 'guess_submitted');
    clientA.send('guess', { guess: 42 });
    await nextMessage(clientA, 'action_rejected');
    clientB.send('leave');
    await nextMessage(clientA, 'player_left');

    expect(
      unparsedMessages([clientA, clientB], wordleRace.serverMessageSchema),
    ).toEqual([]);
  });
});
