import type { RoomListing } from '@marquinhos/contracts/http/routes/activity';
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { randomUUID } from 'node:crypto';
import type { DiscordService } from 'services/discord';
import { startContractServer } from '../helpers/contractServer';

const { callContract } = await import('@marquinhos/api-client/bot');
const activity = await import('@marquinhos/contracts/http/routes/activity');

const guildId = `contract-${randomUUID()}`;

const fakeDiscord = {
  exchangeActivityCode: async () => ({
    access_token: 'discord-access',
    token_type: 'Bearer',
    expires_in: 3600,
    scope: 'identify',
  }),
  getDiscordUser: async () => ({ id: 'u1' }),
  isGuildMember: async () => true,
} as unknown as DiscordService;

const listing: RoomListing = {
  instanceId: 'inst-1',
  roomId: 'ROOM01',
  game: 'tic-tac-toe',
  hostUserId: 'u2',
  playerCount: 1,
  spectatorCount: 0,
  queueDepth: 0,
  queueEnabled: false,
  mode: 'multi',
};

const fakeQueryRooms = async () => [
  { metadata: listing },
  { metadata: { roomId: 'HOSTLESS' } },
];

let server: Awaited<ReturnType<typeof startContractServer>>;

beforeAll(async () => {
  const { createActivityRouter } =
    await import('../../src/routes/activity.route');
  const { default: ActivityController } =
    await import('../../src/controllers/activity.controller');
  server = await startContractServer((app) => {
    app.use(
      '/api/activities',
      createActivityRouter(
        new ActivityController(
          fakeDiscord,
          fakeQueryRooms as unknown as ConstructorParameters<
            typeof ActivityController
          >[1],
        ),
      ),
    );
  });
});

afterAll(() => server.close());

const identity = {
  accessToken: 'discord-access',
  instanceId: 'inst-1',
  guildId,
};

describe('activity contracts', () => {
  it('exchanges an oauth code', async () => {
    const response = await callContract(server.http, activity.exchangeToken, {
      body: { code: 'oauth-code' },
    });

    expect(response.data).toEqual({ access_token: 'discord-access' });
  });

  it('mints a ws session for a multi room', async () => {
    const response = await callContract(server.http, activity.wsSession, {
      body: { ...identity, mode: 'multi', game: 'hangman', roomId: 'ROOM01' },
    });

    expect(response.data.token.length).toBeGreaterThan(0);
    expect(response.data.roomKey).toContain('ROOM01');
  });

  it('creates and lists rooms, dropping listings without a valid shape', async () => {
    const created = await callContract(server.http, activity.createRoom, {
      body: { ...identity, game: 'tic-tac-toe', queueEnabled: false },
    });
    const listed = await callContract(server.http, activity.listRooms, {
      body: identity,
    });

    expect(created.data.roomId).toHaveLength(6);
    expect(listed.data).toEqual([listing]);
  });

  it('records a deep link and claims it once', async () => {
    await callContract(server.http, activity.recordDeepLink, {
      body: { userId: 'u1', guildId, game: 'wordle' },
    });
    const first = await callContract(server.http, activity.claimDeepLink, {
      body: { accessToken: identity.accessToken, guildId },
    });
    const second = await callContract(server.http, activity.claimDeepLink, {
      body: { accessToken: identity.accessToken, guildId },
    });

    expect(first.data).toEqual({ game: 'wordle' });
    expect(second.data).toEqual({ game: null });
  });

  it('runs a pong tournament through create, list and report', async () => {
    const leaderboard = await callContract(
      server.http,
      activity.pongLeaderboard,
      { body: { ...identity, pool: 'classic-1v1', limit: 10 } },
    );
    const created = await callContract(
      server.http,
      activity.createPongTournament,
      {
        body: {
          ...identity,
          name: 'Contract Cup',
          format: 'round-robin',
          pool: 'classic-1v1',
          playerIds: ['u1', 'u2'],
        },
      },
    );
    const match = created.data.matches.find((m) => m.status === 'ready');
    const reported = await callContract(
      server.http,
      activity.reportPongTournamentMatch,
      {
        body: {
          accessToken: identity.accessToken,
          matchId: match?.id ?? '',
          winnerId: 'u1',
        },
      },
    );
    const listed = await callContract(
      server.http,
      activity.listPongTournaments,
      { body: identity },
    );

    expect(Array.isArray(leaderboard.data)).toBe(true);
    expect(created.data.entries.map((e) => e.userId).sort()).toEqual([
      'u1',
      'u2',
    ]);
    expect(
      reported.data.matches.find((m) => m.id === match?.id)?.winnerId,
    ).toBe('u1');
    expect(listed.data.map((t) => t.name)).toContain('Contract Cup');
  });
});
