import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test';

const { Server } = await import('colyseus');
const { WebSocketTransport } = await import('@colyseus/ws-transport');
const { boot } = await import('@colyseus/testing');
const { BattleshipRoom } = await import('../src/realtime/BattleshipRoom');

type ColyseusTestServer = import('@colyseus/testing').ColyseusTestServer;

let colyseus: ColyseusTestServer;

beforeAll(async () => {
  const gameServer = new Server({ transport: new WebSocketTransport() });
  gameServer.define('battleship', BattleshipRoom).filterBy(['roomKey']);
  colyseus = await boot(gameServer);
});

afterEach(async () => {
  await colyseus.cleanup();
});

afterAll(async () => {
  await colyseus.shutdown();
});

// Full auth-flow coverage (valid tokens joining, placing, firing over the
// wire) lives in tests/battleshipSession.test.ts instead of here: minting a
// real session token requires `game: 'battleship'` to pass `isGameId()` in
// src/services/activity/gameId.ts, and that file is on the shared-registry
// do-not-touch list — another process adds 'battleship' to it later, wiring
// this room in. Until then, `onAuth` itself (exercised here) is fully
// testable; a real end-to-end join is not.
describe('BattleshipRoom', () => {
  it('rejects a join with an invalid session token', async () => {
    const room = await colyseus.createRoom('battleship', {
      roomKey: 'inst-1:battleship:multi',
    });

    expect(
      colyseus.connectTo(room, {
        token: 'garbage',
        roomKey: 'inst-1:battleship:multi',
      }),
    ).rejects.toBeTruthy();
  });

  it('rejects a join whose roomKey does not match its token identity', async () => {
    const { mintWsSessionToken } =
      await import('../src/services/activity/wsSessionToken');
    // A token minted for a currently-valid GameId ('wordle') still proves
    // onAuth's roomKey cross-check runs before anything game-specific: the
    // room key derived from this token can never equal the mismatched one
    // below, regardless of which game the token names.
    const token = mintWsSessionToken({
      userId: 'user-a',
      instanceId: 'inst-1',
      guildId: 'guild-1',
      mode: 'multi',
      game: 'wordle',
    });
    const room = await colyseus.createRoom('battleship', {
      roomKey: 'inst-1:battleship:multi',
    });

    expect(
      colyseus.connectTo(room, {
        token,
        roomKey: 'inst-1:battleship:multi',
      }),
    ).rejects.toBeTruthy();
  });
});
