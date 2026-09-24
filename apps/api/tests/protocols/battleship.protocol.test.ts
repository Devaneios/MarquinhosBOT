import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test';

const { MatchRoom } = await import('../../src/realtime/MatchRoom');
const { bootColyseusTestServer, nextMessage, unparsedMessages } =
  await import('../helpers/colyseusTestServer');
const { mintWsSessionToken } =
  await import('../../src/services/activity/wsSessionToken');
const { roomKey } = await import('@marquinhos/domain/activity/roomKey');
const battleship =
  await import('@marquinhos/contracts/activity/games/battleship');

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
    game: 'battleship',
    roomId: 'SHIPS',
  } as const;
  return { token: mintWsSessionToken(identity), roomKey: roomKey(identity) };
}

const fleet = {
  placements: battleship.SHIP_TYPES.map((type, row) => ({
    type,
    x: 0,
    y: row,
    orientation: 'horizontal',
  })),
};

describe('battleship protocol', () => {
  it('sends only messages the battleship protocol describes', async () => {
    const a = creds('user-a');
    const room = await colyseus.createRoom('match', {
      roomKey: a.roomKey,
      game: 'battleship',
    });
    const clientA = await colyseus.connectTo(room, a);
    await nextMessage(clientA, 'init');
    const clientB = await colyseus.connectTo(room, creds('user-b'));
    await nextMessage(clientB, 'init');
    const spectator = await colyseus.connectTo(room, creds('user-c'));
    await nextMessage(spectator, 'init');

    clientA.send('place_ships', { placements: 'all of them' });
    const invalid = await nextMessage(clientA, 'placement_error');
    expect(invalid).toEqual({ message: 'Invalid ship placements' });
    clientA.send('place_ships', fleet);
    await nextMessage(clientA, 'state');
    clientB.send('place_ships', fleet);
    await nextMessage(
      spectator,
      'state',
      (payload) => (payload as { phase: string }).phase === 'battle',
    );
    clientB.send('fire', { x: 0, y: 0 });
    await nextMessage(clientB, 'fire_error');

    expect(
      unparsedMessages(
        [clientA, clientB, spectator],
        battleship.serverMessageSchema,
      ),
    ).toEqual([]);
  });
});
