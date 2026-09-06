import { Database } from 'bun:sqlite';
import { describe, expect, it } from 'bun:test';
import {
  calculateGlicko2,
  PongCompetitionService,
  type PongRating,
} from 'services/activity/pong/PongCompetitionService';

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

function database(): Database {
  const db = new Database(':memory:');
  db.run(`CREATE TABLE pong_ratings (
    user_id TEXT NOT NULL, guild_id TEXT NOT NULL, pool TEXT NOT NULL,
    rating REAL NOT NULL, deviation REAL NOT NULL, volatility REAL NOT NULL,
    matches INTEGER NOT NULL, wins INTEGER NOT NULL, updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, guild_id, pool)
  )`);
  db.run(`CREATE TABLE pong_ranked_matches (
    id TEXT PRIMARY KEY, session_id TEXT NOT NULL, guild_id TEXT NOT NULL,
    pool TEXT NOT NULL, results_json TEXT NOT NULL, played_at INTEGER NOT NULL
  )`);
  return db;
}

describe('PongCompetitionService', () => {
  it('matches the published Glicko-2 reference rating period', () => {
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

  it('starts new players at 1500 with maximum uncertainty', () => {
    const service = new PongCompetitionService(database());

    expect(service.getRating('new', 'guild-1', 'classic-1v1')).toMatchObject({
      rating: 1500,
      deviation: 350,
      volatility: 0.06,
      matches: 0,
      wins: 0,
    });
  });

  it('updates both players atomically and orders the leaderboard', () => {
    const db = database();
    const service = new PongCompetitionService(db);

    service.recordMatch('session-1', 'guild-1', 'classic-1v1', [
      { userId: 'winner', position: 1 },
      { userId: 'loser', position: 2 },
    ]);

    const leaderboard = service.leaderboard('guild-1', 'classic-1v1');
    expect(leaderboard.map((entry) => entry.userId)).toEqual([
      'winner',
      'loser',
    ]);
    expect(leaderboard[0]!.rating).toBeGreaterThan(1500);
    expect(leaderboard[1]!.rating).toBeLessThan(1500);
    expect(leaderboard.every((entry) => entry.matches === 1)).toBe(true);
    expect(
      db.query('SELECT COUNT(*) AS count FROM pong_ranked_matches').get(),
    ).toEqual({ count: 1 });
  });

  it('decomposes four-player placements into simultaneous pairwise results', () => {
    const service = new PongCompetitionService(database());

    const updated = service.recordMatch(
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
