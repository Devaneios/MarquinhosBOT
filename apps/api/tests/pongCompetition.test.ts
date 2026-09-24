import type { PongRating } from '@marquinhos/contracts/http/routes/activity';
import { pongRankedMatches } from '@marquinhos/database/schema';
import { calculateGlicko2 } from '@marquinhos/domain/games/pong/rating';
import { describe, expect, it } from 'bun:test';
import { count } from 'drizzle-orm';
import { PongCompetitionService } from 'services/activity/pong/PongCompetitionService';
import { useTestDb } from './helpers/testDb';

const testDb = useTestDb();

function rating(
  userId: string,
  value: number,
  deviation: number,
  volatility: number,
): PongRating {
  return {
    userId,
    guildId: 'guild-1',
    pool: 'classic-1v1',
    rating: value,
    deviation,
    volatility,
    matches: 0,
    wins: 0,
  };
}

describe('PongCompetitionService', () => {
  it('matches the published Glicko-2 reference rating period', async () => {
    const player = rating('player', 1500, 200, 0.06);
    const result = calculateGlicko2(player, [
      { opponent: rating('a', 1400, 30, 0.06), score: 1 },
      { opponent: rating('b', 1550, 100, 0.06), score: 0 },
      { opponent: rating('c', 1700, 300, 0.06), score: 0 },
    ]);

    expect(result.rating).toBeCloseTo(1464.06, 1);
    expect(result.deviation).toBeCloseTo(151.52, 1);
    expect(result.volatility).toBeCloseTo(0.059996, 5);
  });

  it('starts new players at 1500 with maximum uncertainty', async () => {
    const service = new PongCompetitionService(testDb.current.db);

    expect(
      await service.getRating('new', 'guild-1', 'classic-1v1'),
    ).toMatchObject({
      rating: 1500,
      deviation: 350,
      volatility: 0.06,
      matches: 0,
      wins: 0,
    });
  });

  it('updates both players atomically and orders the leaderboard', async () => {
    const service = new PongCompetitionService(testDb.current.db);

    await service.recordMatch('session-1', 'guild-1', 'classic-1v1', [
      { userId: 'winner', position: 1 },
      { userId: 'loser', position: 2 },
    ]);

    const leaderboard = await service.leaderboard('guild-1', 'classic-1v1');
    expect(leaderboard.map((entry) => entry.userId)).toEqual([
      'winner',
      'loser',
    ]);
    expect(leaderboard[0]!.rating).toBeGreaterThan(1500);
    expect(leaderboard[1]!.rating).toBeLessThan(1500);
    expect(leaderboard.every((entry) => entry.matches === 1)).toBe(true);
    expect(
      await testDb.current.db
        .select({ count: count() })
        .from(pongRankedMatches),
    ).toEqual([{ count: 1 }]);
  });

  it('applies concurrent matches for the same player one after another', async () => {
    const service = new PongCompetitionService(testDb.current.db);

    await Promise.all(
      ['a', 'b', 'c'].map((opponent, index) =>
        service.recordMatch(`session-${index}`, 'guild-1', 'classic-1v1', [
          { userId: 'shared', position: 1 },
          { userId: opponent, position: 2 },
        ]),
      ),
    );

    const shared = await service.getRating('shared', 'guild-1', 'classic-1v1');
    expect(shared.matches).toBe(3);
    expect(shared.wins).toBe(3);
  });

  it('decomposes four-player placements into simultaneous pairwise results', async () => {
    const service = new PongCompetitionService(testDb.current.db);

    const updated = await service.recordMatch(
      'session-2',
      'guild-1',
      'quad-elimination',
      [
        { userId: 'first', position: 1 },
        { userId: 'second', position: 2 },
        { userId: 'third', position: 3 },
        { userId: 'fourth', position: 4 },
      ],
    );

    expect(updated[0]!.rating).toBeGreaterThan(updated[1]!.rating);
    expect(updated[1]!.rating).toBeGreaterThan(updated[2]!.rating);
    expect(updated[2]!.rating).toBeGreaterThan(updated[3]!.rating);
  });
});
