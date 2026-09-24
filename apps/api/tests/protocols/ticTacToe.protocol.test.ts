import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test';

const { MatchRoom } = await import('../../src/realtime/MatchRoom');
const { bootColyseusTestServer, nextMessage, unparsedMessages } =
  await import('../helpers/colyseusTestServer');
const { mintWsSessionToken } =
  await import('../../src/services/activity/wsSessionToken');
const { roomKey } = await import('services/activity/roomKey');
const ticTacToe =
  await import('@marquinhos/contracts/activity/games/ticTacToe');

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
    game: 'tic-tac-toe',
    roomId: 'TICTACTOE',
  } as const;
  return { token: mintWsSessionToken(identity), roomKey: roomKey(identity) };
}

describe('tic-tac-toe protocol', () => {
  it('sends only messages the tic-tac-toe protocol describes', async () => {
    const a = creds('user-a');
    const room = await colyseus.createRoom('match', {
      roomKey: a.roomKey,
      game: 'tic-tac-toe',
    });
    const clientA = await colyseus.connectTo(room, a);
    const clientB = await colyseus.connectTo(room, creds('user-b'));
    const initA = await nextMessage<{ player: string }>(clientA, 'init');
    await nextMessage(clientB, 'game_ready');
    const x = initA.player === 'X' ? clientA : clientB;
    const o = x === clientA ? clientB : clientA;

    x.send('move', { row: 0, col: 0 });
    await nextMessage(o, 'state_update');
    x.send('move', { row: 1, col: 1 });
    await nextMessage(x, 'action_rejected');
    await clientA.leave();
    await nextMessage(clientB, 'opponent_disconnected');

    expect(
      unparsedMessages([clientA, clientB], ticTacToe.serverMessageSchema),
    ).toEqual([]);
  });
});
