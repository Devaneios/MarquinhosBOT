import type { TowerState } from '@marquinhos/contracts/activity/games/towerUnstable';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test';

const { MatchRoom } = await import('../../src/realtime/MatchRoom');
const { bootColyseusTestServer, nextMessage, unparsedMessages } =
  await import('../helpers/colyseusTestServer');
const { mintWsSessionToken } =
  await import('../../src/services/activity/wsSessionToken');
const { roomKey } = await import('services/activity/roomKey');
const tower =
  await import('@marquinhos/contracts/activity/games/towerUnstable');

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
    game: 'tower-unstable',
    roomId: 'TOWER',
  } as const;
  return { token: mintWsSessionToken(identity), roomKey: roomKey(identity) };
}

describe('tower-unstable protocol', () => {
  it('sends only messages the tower protocol describes', async () => {
    const a = creds('user-a');
    const room = await colyseus.createRoom('match', {
      roomKey: a.roomKey,
      game: 'tower-unstable',
    });
    const clientA = await colyseus.connectTo(room, a);
    await nextMessage(clientA, 'init');
    const clientB = await colyseus.connectTo(room, creds('user-b'));
    await nextMessage(clientB, 'init');
    const { state } = (await nextMessage(clientA, 'game_ready')) as {
      state: TowerState;
    };
    const [current, waiting] =
      state.currentPlayer === 'user-a'
        ? [clientA, clientB]
        : [clientB, clientA];

    waiting.send('pull', { level: 0, position: 0 });
    await nextMessage(waiting, 'action_rejected');
    current.send('pull', { level: 0.5, position: 0 });
    const invalid = await nextMessage(current, 'action_rejected');
    expect(invalid).toEqual({ error: 'Invalid pull coordinates' });
    current.send('pull', { level: 0, position: 0 });
    await nextMessage(waiting, 'state_update');

    expect(
      unparsedMessages([clientA, clientB], tower.serverMessageSchema),
    ).toEqual([]);
  });
});
