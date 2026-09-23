import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { startContractServer } from '../helpers/contractServer';

const { callContract } = await import('@marquinhos/api-client/bot');
const gamification =
  await import('@marquinhos/contracts/http/routes/gamification');
const evolutive =
  await import('@marquinhos/contracts/http/routes/evolutiveAchievements');

const guildId = `contract-${randomUUID()}`;

let server: Awaited<ReturnType<typeof startContractServer>>;

beforeAll(async () => {
  const { default: gamificationRouter } =
    await import('../../src/routes/gamification.route');
  const { default: evolutiveRouter } =
    await import('../../src/routes/evolutiveAchievements.route');
  server = await startContractServer((app) => {
    app.use('/api/gamification', gamificationRouter);
    app.use('/api/evolutive-achievements', evolutiveRouter);
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

  it('unlocks an achievement once and lists it with its rarity', async () => {
    const first = await callContract(
      server.http,
      gamification.unlockAchievement,
      { body: { userId: 'u2', guildId, achievementId: 'commands_10' } },
    );
    const second = await callContract(
      server.http,
      gamification.unlockAchievement,
      { body: { userId: 'u2', guildId, achievementId: 'commands_10' } },
    );
    const listed = await callContract(
      server.http,
      gamification.getUserAchievements,
      { params: { userId: 'u2', guildId } },
    );

    expect(first.data).toEqual({ unlocked: true });
    expect(second.data).toEqual({ unlocked: false });
    const achievement = listed.data.find(
      (entry) => entry.achievementId === 'commands_10',
    );
    expect(achievement?.unlockedAt).toBeInstanceOf(Date);
    expect(achievement?.rarity).toBe('common');
  });

  it('lists and creates achievements', async () => {
    const created = await callContract(
      server.http,
      gamification.createAchievement,
      {
        body: {
          id: 'contract_test',
          name: 'Contract',
          description: 'Created by a contract test',
          category: 'test',
          rarity: 'epic',
          icon: '🧪',
          condition: { type: 'commands', threshold: 999 },
          reward_xp: 1,
        },
      },
    );
    const all = await callContract(
      server.http,
      gamification.getAllAchievements,
      {},
    );

    expect(created.data.id).toBe('contract_test');
    expect(all.data.map((a) => a.id)).toContain('contract_test');
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

describe('evolutive achievement contracts', () => {
  it('evolves and lists evolutive achievements with a timeline', async () => {
    const evolved = await callContract(server.http, evolutive.checkAndEvolve, {
      params: { userId: 'u1', guildId },
    });
    const listed = await callContract(
      server.http,
      evolutive.getUserEvolutiveAchievements,
      { params: { userId: 'u1', guildId } },
    );
    const timeline = await callContract(
      server.http,
      evolutive.getEvolutionTimeline,
      { params: { userId: 'u1', guildId } },
    );

    expect(Array.isArray(evolved.data)).toBe(true);
    for (const achievement of listed.data) {
      expect(achievement.unlockedAt).toBeInstanceOf(Date);
    }
    expect(timeline.data.length).toBe(listed.data.length);
  });
});
