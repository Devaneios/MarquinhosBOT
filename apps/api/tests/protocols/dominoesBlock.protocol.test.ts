import type { DominoesClientState } from '@marquinhos/contracts/activity/games/dominoesBlock';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test';

const { MatchRoom } = await import('../../src/realtime/MatchRoom');
const { bootColyseusTestServer, nextMessage, unparsedMessages } =
  await import('../helpers/colyseusTestServer');
const { mintWsSessionToken } =
  await import('../../src/services/activity/wsSessionToken');
const { roomKey } = await import('services/activity/roomKey');
const dominoes =
  await import('@marquinhos/contracts/activity/games/dominoesBlock');

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
    game: 'dominoes-block',
    roomId: 'DOMINO',
  } as const;
  return { token: mintWsSessionToken(identity), roomKey: roomKey(identity) };
}

describe('dominoes-block protocol', () => {
  it('sends only messages the dominoes protocol describes', async () => {
    const a = creds('user-a');
    const room = await colyseus.createRoom('match', {
      roomKey: a.roomKey,
      game: 'dominoes-block',
    });
    const clientA = await colyseus.connectTo(room, a);
    const clientB = await colyseus.connectTo(room, creds('user-b'));
    const state = (await nextMessage(
      clientA,
      'state',
      (payload) => (payload as DominoesClientState).currentPlayer !== null,
    )) as DominoesClientState;
    const waiting = state.currentPlayer === 'user-a' ? clientB : clientA;

    clientA.send('play', { tile: { a: 9, b: 0 } });
    const malformed = await nextMessage(clientA, 'move_rejected');
    expect(malformed).toEqual({ reason: 'Malformed tile' });
    waiting.send('pass');
    await nextMessage(waiting, 'move_rejected');

    expect(
      unparsedMessages([clientA, clientB], dominoes.serverMessageSchema),
    ).toEqual([]);
  });
});
