import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { TokenCipherService } from 'common/crypto';
import { WsSessionTokenService } from 'modules/activity/ws-session-token';
import { createMatchRoom } from '../src/realtime/MatchRoom';
import { bootColyseusTestServer } from './helpers/colyseusTestServer';
import { testRoomDependencies } from './helpers/realtimeTestDependencies';
import { createTestAppConfig } from './helpers/testAppConfig';

const invalidSecretTokens = new WsSessionTokenService(
  new TokenCipherService(
    createTestAppConfig({ MARQUINHOS_SECRET_KEY: 'room-auth-wrong-secret' }),
  ),
);

let colyseus: Awaited<ReturnType<typeof bootColyseusTestServer>>;

beforeAll(async () => {
  colyseus = await bootColyseusTestServer((server) => {
    server.define('match', createMatchRoom(testRoomDependencies));
  });
});

afterAll(async () => {
  await colyseus?.shutdown();
});

describe('MatchRoom room creation auth', () => {
  it('rejects room creation when the supplied token uses another secret', async () => {
    const token = invalidSecretTokens.mint({
      userId: 'user-1',
      instanceId: 'instance-1',
      guildId: 'guild-1',
      mode: 'single',
      game: 'pong',
    });

    await expect(
      colyseus.createRoom('match', {
        game: 'pong',
        roomKey: 'instance-1:pong:single',
        token,
      }),
    ).rejects.toThrow('Invalid or expired session token');
  });
});
