import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test';

const { MatchRoom } = await import('../../src/realtime/MatchRoom');
const { bootColyseusTestServer, nextMessage, receivedLog } =
  await import('../helpers/colyseusTestServer');
const { mintWsSessionToken } =
  await import('../../src/services/activity/wsSessionToken');
const { roomKey } = await import('@marquinhos/domain/activity/roomKey');
const checkers = await import('@marquinhos/contracts/activity/games/checkers');

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
    game: 'checkers',
    roomId: 'CHECKERS',
  } as const;
  return { token: mintWsSessionToken(identity), roomKey: roomKey(identity) };
}

describe('checkers protocol', () => {
  it('sends only messages the checkers protocol describes', async () => {
    const a = creds('user-a');
    const room = await colyseus.createRoom('match', {
      roomKey: a.roomKey,
      game: 'checkers',
    });
    const clientA = await colyseus.connectTo(room, a);
    const clientB = await colyseus.connectTo(room, creds('user-b'));
    const initA = await nextMessage<{ color: string }>(clientA, 'init');
    await nextMessage(clientB, 'init');
    const black = initA.color === 'black' ? clientA : clientB;
    const red = black === clientA ? clientB : clientA;

    black.send('move', { from: { row: 2, col: 1 }, to: { row: 3, col: 2 } });
    await nextMessage(
      red,
      'state',
      (state: unknown) =>
        checkers.checkersStateSchema.safeParse(state).data?.turn === 'red',
    );
    red.send('move', { from: { row: 0, col: 0 }, to: { row: 7, col: 7 } });
    await nextMessage(red, 'action_rejected');
    await clientA.leave();
    await nextMessage(clientB, 'opponent_disconnected');

    for (const client of [clientA, clientB]) {
      for (const { type, message } of receivedLog(client)) {
        const parsed = checkers.serverMessageSchema.safeParse(
          message === undefined ? { type } : { type, payload: message },
        );
        expect({ type, ok: parsed.success }).toEqual({ type, ok: true });
      }
    }
  });
});
