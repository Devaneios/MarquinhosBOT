import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { startNestContractServer } from '../helpers/contractServer';

const { callContract } = await import('@marquinhos/api-client/bot');
const gamification =
  await import('@marquinhos/contracts/http/routes/gamification');

const guildId = `contract-${randomUUID()}`;

let server: Awaited<ReturnType<typeof startNestContractServer>>;

beforeAll(async () => {
  const { GamificationModule } =
    await import('modules/gamification/gamification.module');
  server = await startNestContractServer({
    imports: [GamificationModule],
  });
  await callContract(server.http, gamification.initializeDefaults, {});
});

afterAll(() => server.close());

describe('gamification contracts', () => {
  it('serves the xp config', async () => {
    const response = await callContract(
      server.http,
      gamification.getXpConfig,
      {},
    );

    expect(response.data).toContainEqual({
      event_type: 'command',
      xp_amount: 5,
      cooldown_ms: 60_000,
    });
    expect(
      response.data.some(({ event_type }) => event_type === 'achievement'),
    ).toBe(false);
  });

  it('adds xp and reads the level back with dates revived', async () => {
    const added = await callContract(server.http, gamification.addXp, {
      body: { userId: 'u1', guildId, eventType: 'command' },
    });
    const level = await callContract(server.http, gamification.getUserLevel, {
      params: { userId: 'u1', guildId },
    });

    expect(added.message).toBe('XP added');
    expect(added.data.onCooldown).toBe(false);
    expect(added.data.userLevel.userId).toBe('u1');
    expect(level.data.guildId).toBe(guildId);
    expect(level.data.lastXpGain).toBeInstanceOf(Date);
  });

  it('ranks the guild leaderboard', async () => {
    const response = await callContract(
      server.http,
      gamification.getLeaderboard,
      { params: { guildId }, query: { limit: 5 } },
    );

    expect(response.data.map((entry) => entry.userId)).toEqual(['u1']);
  });

  it('records a game result and reports it in stats and leaderboard', async () => {
    const recorded = await callContract(
      server.http,
      gamification.recordGameResult,
      {
        body: {
          sessionId: randomUUID(),
          guildId,
          gameType: 'dice',
          results: [{ userId: 'u3', position: 1 }],
        },
      },
    );
    const stats = await callContract(
      server.http,
      gamification.getUserGameStats,
      { params: { userId: 'u3', guildId } },
    );
    const board = await callContract(
      server.http,
      gamification.getGameLeaderboard,
      { params: { guildId, gameType: 'dice' } },
    );

    expect(recorded.message).toBe('Game result recorded');
    expect(stats.data.byGame).toEqual([
      { game_type: 'dice', games_played: 1, wins: 1 },
    ]);
    expect(board.data.map((entry) => [entry.user_id, entry.wins])).toEqual([
      ['u3', 1],
    ]);
  });
});
