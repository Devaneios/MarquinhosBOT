import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test';

const { MatchRoom } = await import('../../src/realtime/MatchRoom');
const { bootColyseusTestServer, nextMessage, unparsedMessages } =
  await import('../helpers/colyseusTestServer');
const { mintWsSessionToken } =
  await import('../../src/services/activity/wsSessionToken');
const { roomKey } = await import('@marquinhos/domain/activity/roomKey');
const snake = await import('@marquinhos/contracts/activity/games/snakeGame');

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
    game: 'snake-game',
    roomId: 'SNAKE',
  } as const;
  return { token: mintWsSessionToken(identity), roomKey: roomKey(identity) };
}

describe('snake-game protocol', () => {
  it('sends only messages the snake protocol describes', async () => {
    const a = creds('user-a');
    const room = await colyseus.createRoom('match', {
      roomKey: a.roomKey,
      game: 'snake-game',
    });
    const clientA = await colyseus.connectTo(room, a);
    await nextMessage(clientA, 'init');
    const clientB = await colyseus.connectTo(room, creds('user-b'));
    await nextMessage(clientB, 'init');
    await nextMessage(clientA, 'state');

    clientA.send('input', { direction: 'sideways' });
    const rejected = await nextMessage(clientA, 'input_error');
    expect(rejected).toEqual({ message: 'Invalid direction' });
    clientA.send('input', { direction: 'up' });
    await nextMessage(clientB, 'state');

    expect(
      unparsedMessages([clientA, clientB], snake.serverMessageSchema),
    ).toEqual([]);
  });
});
