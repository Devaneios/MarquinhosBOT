import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { DiscordService } from 'integrations/discord/discord.service';
import { ACTIVITY_ROOM_QUERY } from 'modules/activity/activity.tokens';
import {
  requestController,
  startNestControllerServer,
} from './helpers/nestControllerServer';

const identityByToken: Record<string, string> = {
  'tok-user-1': 'user-1',
  'tok-user-2': 'user-2',
  'tok-real-user': 'user-real',
};

let server: Awaited<ReturnType<typeof startNestControllerServer>>;

beforeAll(async () => {
  const { ActivityModule } = await import('modules/activity/activity.module');
  server = await startNestControllerServer(
    { imports: [ActivityModule] },
    (builder) =>
      builder
        .overrideProvider(DiscordService)
        .useValue({
          getDiscordUser: async (token: string) => {
            const id = identityByToken[token];
            return id ? { id } : null;
          },
          isGuildMember: async () => true,
        })
        .overrideProvider(ACTIVITY_ROOM_QUERY)
        .useValue(async () => []),
  );
});

afterAll(() => server.close());

async function post(path: string, body: unknown) {
  return requestController(server, `/activities${path}`, {
    method: 'POST',
    body,
    token: `Bearer ${server.activityToken}`,
  });
}

describe('ActivityController deep-link intent HTTP routes', () => {
  it('records an intent and lets a matching claim consume it once', async () => {
    const guildId = `guild-${crypto.randomUUID()}`;
    const recorded = await post('/deep-link', {
      userId: 'user-1',
      guildId,
      game: 'wordle',
    });
    expect(recorded.status).toBe(200);
    expect(recorded.body).toEqual({ data: { ok: true } });

    const first = await post('/deep-link/claim', {
      accessToken: 'tok-user-1',
      guildId,
    });
    const second = await post('/deep-link/claim', {
      accessToken: 'tok-user-1',
      guildId,
    });
    expect(first.status).toBe(200);
    expect(first.body).toEqual({ data: { game: 'wordle' } });
    expect(second.body).toEqual({ data: { game: null } });
  });

  it('returns a null game when there is no pending intent', async () => {
    const response = await post('/deep-link/claim', {
      accessToken: 'tok-user-2',
      guildId: `guild-${crypto.randomUUID()}`,
    });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: { game: null } });
  });

  it('returns 401 for an invalid access token without exposing intent state', async () => {
    const guildId = `guild-${crypto.randomUUID()}`;
    await post('/deep-link', {
      userId: 'user-1',
      guildId,
      game: 'wordle',
    });
    const response = await post('/deep-link/claim', {
      accessToken: 'bad-token',
      guildId,
    });
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: 'Invalid access token' });
  });

  it('derives the claim identity from Discord rather than request input', async () => {
    const guildId = `guild-${crypto.randomUUID()}`;
    await post('/deep-link', {
      userId: 'user-real',
      guildId,
      game: 'wordle',
    });
    const response = await post('/deep-link/claim', {
      accessToken: 'tok-real-user',
      guildId,
    });
    expect(response.body).toEqual({ data: { game: 'wordle' } });
  });
});
