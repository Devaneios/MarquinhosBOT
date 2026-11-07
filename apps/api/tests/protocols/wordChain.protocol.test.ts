import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test';
import { testRoomDependencies } from '../helpers/realtimeTestDependencies';

const { createMatchRoom } = await import('../../src/realtime/MatchRoom');
const { bootColyseusTestServer, nextMessage, unparsedMessages } =
  await import('../helpers/colyseusTestServer');
const { mintWsSessionToken } =
  await import('../../src/modules/activity/ws-session-token');
const { roomKey } = await import('modules/activity/room-key');
const wordChain =
  await import('@marquinhos/contracts/activity/games/wordChain');

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

function creds(userId: string) {
  const identity = {
    userId,
    instanceId: 'inst-1',
    guildId: 'guild-1',
    mode: 'multi',
    game: 'word-chain',
    roomId: 'WORDCHAIN',
  } as const;
  return { token: mintWsSessionToken(identity), roomKey: roomKey(identity) };
}

describe('word-chain protocol', () => {
  it('sends only messages the word-chain protocol describes', async () => {
    const a = creds('user-a');
    const room = await colyseus.createRoom('match', {
      roomKey: a.roomKey,
      game: 'word-chain',
    });
    const clientA = await colyseus.connectTo(room, a);
    const clientB = await colyseus.connectTo(room, creds('user-b'));
    await nextMessage(clientA, 'init');
    await nextMessage(clientB, 'init');

    clientA.send('word', { word: 'abelha' });
    await nextMessage(
      clientB,
      'state',
      (state: { currentWord: string }) => state.currentWord === 'abelha',
    );
    clientA.send('word', { word: 'abacaxi' });
    await nextMessage(clientA, 'action_rejected');
    await clientA.leave();
    await nextMessage(clientB, 'opponent_disconnected');

    expect(
      unparsedMessages([clientA, clientB], wordChain.serverMessageSchema),
    ).toEqual([]);
  });
});
