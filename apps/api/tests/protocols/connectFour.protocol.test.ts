import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test';

const { MatchRoom } = await import('../../src/realtime/MatchRoom');
const { bootColyseusTestServer, nextMessage, unparsedMessages } =
  await import('../helpers/colyseusTestServer');
const { mintWsSessionToken } =
  await import('../../src/services/activity/wsSessionToken');
const { roomKey } = await import('@marquinhos/domain/activity/roomKey');
const connectFour =
  await import('@marquinhos/contracts/activity/games/connectFour');

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
    game: 'connect-four',
    roomId: 'CONNECT4',
  } as const;
  return { token: mintWsSessionToken(identity), roomKey: roomKey(identity) };
}

describe('connect-four protocol', () => {
  it('sends only messages the connect-four protocol describes', async () => {
    const a = creds('user-a');
    const room = await colyseus.createRoom('match', {
      roomKey: a.roomKey,
      game: 'connect-four',
    });
    const clientA = await colyseus.connectTo(room, a);
    const clientB = await colyseus.connectTo(room, creds('user-b'));
    const initA = await nextMessage<{ disc: string }>(clientA, 'init');
    await nextMessage(clientB, 'init');
    const p1 = initA.disc === 'p1' ? clientA : clientB;
    const p2 = p1 === clientA ? clientB : clientA;

    p1.send('drop', { col: 3 });
    await nextMessage(p2, 'state');
    p1.send('drop', { col: 3 });
    await nextMessage(p1, 'move_rejected');
    await clientA.leave();
    await nextMessage(clientB, 'opponent_disconnected');

    expect(
      unparsedMessages([clientA, clientB], connectFour.serverMessageSchema),
    ).toEqual([]);
  });
});
