import { describe, expect, it } from 'bun:test';
import { requireAuth, type AuthedClient } from 'realtime/authedClient';
import type { WsSessionPayload } from 'services/activity/wsSessionToken';

const payload: WsSessionPayload = {
  userId: 'user-1',
  instanceId: 'instance-1',
  guildId: 'guild-1',
  mode: 'multi',
  game: 'pong',
  roomId: 'room-1',
};

function makeClient(auth: WsSessionPayload | undefined): AuthedClient {
  return { auth } as AuthedClient;
}

describe('requireAuth', () => {
  it('returns the session payload set by onAuth', () => {
    expect(requireAuth(makeClient(payload))).toEqual(payload);
  });

  it('throws when the client never went through onAuth', () => {
    expect(() => requireAuth(makeClient(undefined))).toThrow(
      'Client has no authenticated session',
    );
  });
});
