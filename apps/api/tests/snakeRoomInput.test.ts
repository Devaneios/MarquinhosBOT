import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test';

const { SnakeRoom } = await import('../src/realtime/SnakeRoom');
const { bootColyseusTestServer } = await import('./helpers/colyseusTestServer');
const { mintWsSessionToken } =
  await import('../src/services/activity/wsSessionToken');
const { roomKey } = await import('../src/services/activity/roomKey');

type ColyseusTestServer = import('@colyseus/testing').ColyseusTestServer;

let colyseus: ColyseusTestServer;

beforeAll(async () => {
  colyseus = await bootColyseusTestServer((server) => {
    server.define('snake-game', SnakeRoom).filterBy(['roomKey']);
  });
});

afterEach(async () => {
  if (colyseus) await colyseus.cleanup();
});

afterAll(async () => {
  if (colyseus) await colyseus.shutdown();
});

describe('SnakeRoom input', () => {
  it('rejects a direction the engine does not know instead of forwarding it', async () => {
    const identity = {
      userId: 'user-a',
      instanceId: 'inst-1',
      guildId: 'guild-1',
      mode: 'single',
      game: 'snake-game',
    } as const;
    const key = roomKey(identity);
    const room = await colyseus.createRoom('snake-game', { roomKey: key });
    const client = await colyseus.connectTo(room, {
      token: mintWsSessionToken(identity),
      roomKey: key,
    });

    const error = new Promise((resolve) =>
      client.onMessage('input_error', resolve),
    );
    client.send('input', { direction: 'sideways' });

    expect(await error).toEqual({ message: 'Invalid direction' });
  });
});
