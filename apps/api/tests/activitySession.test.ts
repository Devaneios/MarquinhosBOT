import { describe, expect, it } from 'bun:test';
import type { DiscordUser } from 'integrations/discord/discord.service';
import {
  ActivitySessionService,
  InvalidActivitySessionError,
} from 'modules/activity/activity-session.service';
import { roomKey } from 'modules/activity/room-key';
import { testWsSessionTokens } from './helpers/wsSessionTokens';

const service = () => new ActivitySessionService(testWsSessionTokens);
const user: DiscordUser = { id: 'user-1', global_name: 'Global' };

describe('ActivitySessionService', () => {
  it('marks a single-player Wordle session as membership-verified', () => {
    const session = service().issueSession(user, {
      instanceId: 'inst-1',
      guildId: 'guild-1',
      mode: 'single',
      game: 'wordle',
    });

    expect(testWsSessionTokens.verify(session.token)).toMatchObject({
      guildMembershipVerified: true,
    });
  });

  it('binds a multi session to its room', () => {
    const request = {
      instanceId: 'inst-1',
      guildId: 'guild-1',
      mode: 'multi',
      game: 'tic-tac-toe',
      roomId: 'ROOM01',
    } as const;
    const session = service().issueSession(user, request);

    expect(session.roomKey).toBe(roomKey({ ...request, userId: user.id }));
  });

  it('rejects an unknown Pong ruleset', () => {
    expect(() =>
      service().issueSession(user, {
        instanceId: 'inst-1',
        guildId: 'guild-1',
        mode: 'single',
        game: 'pong',
        ruleset: 'unknown-ruleset',
      }),
    ).toThrow(new InvalidActivitySessionError('Invalid Pong ruleset'));
  });

  it('creates a room with a six-character id from the room alphabet', () => {
    const room = service().createRoom(user, {
      instanceId: 'inst-1',
      guildId: 'guild-1',
      game: 'tic-tac-toe',
      queueEnabled: true,
    });

    expect(room.roomId).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
    expect(testWsSessionTokens.verify(room.token)?.queueEnabled).toBe(true);
  });
});
