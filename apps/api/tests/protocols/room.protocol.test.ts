import type { RoomState } from '@marquinhos/contracts/activity/room';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test';

const { MatchRoom } = await import('../../src/realtime/MatchRoom');
const { bootColyseusTestServer, nextMessage, unparsedMessages } =
  await import('../helpers/colyseusTestServer');
const { mintWsSessionToken } =
  await import('../../src/services/activity/wsSessionToken');
const { roomKey } = await import('../../src/services/activity/roomKey');
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
    roomId: 'LOBBY',
  } as const;
  return { token: mintWsSessionToken(identity), roomKey: roomKey(identity) };
}

describe('room protocol', () => {
  it('pushes room state to members and parses room-level messages', async () => {
    const a = creds('user-a');
    const matchRoom = await colyseus.createRoom('match', {
      game: 'tic-tac-toe',
      roomKey: a.roomKey,
    });
    const host = await colyseus.connectTo(matchRoom, a);
    const alone = await nextMessage<RoomState>(host, 'room_state');
    expect(alone).toEqual({
      game: 'tic-tac-toe',
      hostUserId: 'user-a',
      queueEnabled: false,
      matchInProgress: false,
      members: [{ userId: 'user-a', role: 'player' }],
    });

    const guest = await colyseus.connectTo(matchRoom, creds('user-b'));
    const seated = await nextMessage<RoomState>(
      guest,
      'room_state',
      (state) => (state as RoomState).members.length === 2,
    );
    expect(seated.matchInProgress).toBe(true);

    host.send('toggle_queue', { enabled: 'yes' });
    const rejected = await nextMessage(host, 'action_rejected');
    expect(rejected).toEqual({ error: 'Invalid queue toggle' });
    host.send('toggle_queue', { enabled: true });
    await nextMessage(
      guest,
      'room_state',
      (state) => (state as RoomState).queueEnabled,
    );

    expect(
      unparsedMessages([host, guest], ticTacToe.serverMessageSchema),
    ).toEqual([]);
  });
});
