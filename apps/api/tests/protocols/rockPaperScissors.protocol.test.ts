import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test';
import { testRoomDependencies } from '../helpers/realtimeTestDependencies';

const { createMatchRoom } = await import('../../src/realtime/MatchRoom');
const { bootColyseusTestServer, nextMessage, unparsedMessages } =
  await import('../helpers/colyseusTestServer');
const { mintWsSessionToken } =
  await import('../../src/modules/activity/ws-session-token');
const { roomKey } = await import('modules/activity/room-key');
const rps =
  await import('@marquinhos/contracts/activity/games/rockPaperScissors');

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
    game: 'rock-paper-scissors',
    roomId: 'RPS',
  } as const;
  return { token: mintWsSessionToken(identity), roomKey: roomKey(identity) };
}

describe('rock-paper-scissors protocol', () => {
  it('sends only messages the rock-paper-scissors protocol describes', async () => {
    const a = creds('user-a');
    const room = await colyseus.createRoom('match', {
      roomKey: a.roomKey,
      game: 'rock-paper-scissors',
    });
    const clientA = await colyseus.connectTo(room, a);
    const clientB = await colyseus.connectTo(room, creds('user-b'));
    await nextMessage(clientA, 'game_start');

    clientA.send('pick', { pick: 'lizard' });
    await nextMessage(clientA, 'error');
    for (let round = 0; round < 2; round++) {
      clientA.send('pick', { pick: 'rock' });
      clientB.send('pick', { pick: 'scissors' });
      await nextMessage(clientB, 'round_result');
    }
    await nextMessage(clientB, 'match_end');

    expect(
      unparsedMessages([clientA, clientB], rps.serverMessageSchema),
    ).toEqual([]);
  });
});
