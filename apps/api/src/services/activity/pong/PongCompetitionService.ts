import type { Database } from 'bun:sqlite';
import { db as defaultDb } from 'database/sqlite';
import { nanoid } from 'nanoid';

export type PongRatingPool = 'classic-1v1' | 'quad-elimination';

export interface PongRating {
  userId: string;
  guildId: string;
  pool: PongRatingPool;
  rating: number;
  deviation: number;
  volatility: number;
  matches: number;
  wins: number;
}

export interface PongRankedResult {
  userId: string;
  position: number;
}

interface OpponentResult {
  opponent: PongRating;
  score: number;
}

const SCALE = 173.7178;
const TAU = 0.5;
const EPSILON = 0.000001;

function g(phi: number): number {
  return 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
}

function expectation(mu: number, opponentMu: number, opponentPhi: number) {
  return 1 / (1 + Math.exp(-g(opponentPhi) * (mu - opponentMu)));
}

function nextVolatility(
  phi: number,
  sigma: number,
  delta: number,
  variance: number,
): number {
  const a = Math.log(sigma * sigma);
  const f = (x: number) => {
    const ex = Math.exp(x);
    const numerator = ex * (delta * delta - phi * phi - variance - ex);
    const denominator = 2 * (phi * phi + variance + ex) ** 2;
    return numerator / denominator - (x - a) / (TAU * TAU);
  };
  let lower = a;
  let upper: number;
  if (delta * delta > phi * phi + variance) {
    upper = Math.log(delta * delta - phi * phi - variance);
  } else {
    let k = 1;
    while (f(a - k * TAU) < 0) k += 1;
    upper = a - k * TAU;
  }
  let fLower = f(lower);
  let fUpper = f(upper);
  while (Math.abs(upper - lower) > EPSILON) {
    const next = lower + ((lower - upper) * fLower) / (fUpper - fLower);
    const fNext = f(next);
    if (fNext * fUpper <= 0) {
      lower = upper;
      fLower = fUpper;
    } else {
      fLower /= 2;
    }
    upper = next;
    fUpper = fNext;
  }
  return Math.exp(lower / 2);
}

export function calculateGlicko2(
  player: PongRating,
  results: OpponentResult[],
): Pick<PongRating, 'rating' | 'deviation' | 'volatility'> {
  const mu = (player.rating - 1500) / SCALE;
  const phi = player.deviation / SCALE;
  if (results.length === 0) {
    return {
      rating: player.rating,
      deviation: Math.min(
        350,
        Math.sqrt(phi * phi + player.volatility ** 2) * SCALE,
      ),
      volatility: player.volatility,
    };
  }
  const converted = results.map(({ opponent, score }) => ({
    mu: (opponent.rating - 1500) / SCALE,
    phi: opponent.deviation / SCALE,
    score,
  }));
  const variance =
    1 /
    converted.reduce((sum, result) => {
      const expected = expectation(mu, result.mu, result.phi);
      return sum + g(result.phi) ** 2 * expected * (1 - expected);
    }, 0);
  const improvement = converted.reduce((sum, result) => {
    const expected = expectation(mu, result.mu, result.phi);
    return sum + g(result.phi) * (result.score - expected);
  }, 0);
  const delta = variance * improvement;
  const volatility = nextVolatility(phi, player.volatility, delta, variance);
  const preDeviation = Math.sqrt(phi * phi + volatility * volatility);
  const nextPhi =
    1 / Math.sqrt(1 / (preDeviation * preDeviation) + 1 / variance);
  const nextMu = mu + nextPhi * nextPhi * improvement;
  return {
    rating: nextMu * SCALE + 1500,
    deviation: nextPhi * SCALE,
    volatility,
  };
}

export class PongCompetitionService {
  constructor(private database: Database = defaultDb) {}

  getRating(userId: string, guildId: string, pool: PongRatingPool): PongRating {
    const row = this.database
      .query(
        `SELECT user_id, guild_id, pool, rating, deviation, volatility, matches, wins
         FROM pong_ratings WHERE user_id = ? AND guild_id = ? AND pool = ?`,
      )
      .get(userId, guildId, pool) as {
      user_id: string;
      guild_id: string;
      pool: PongRatingPool;
      rating: number;
      deviation: number;
      volatility: number;
      matches: number;
      wins: number;
    } | null;
    return row
      ? {
          userId: row.user_id,
          guildId: row.guild_id,
          pool: row.pool,
          rating: row.rating,
          deviation: row.deviation,
          volatility: row.volatility,
          matches: row.matches,
          wins: row.wins,
        }
      : {
          userId,
          guildId,
          pool,
          rating: 1500,
          deviation: 350,
          volatility: 0.06,
          matches: 0,
          wins: 0,
        };
  }

  recordMatch(
    sessionId: string,
    guildId: string,
    pool: PongRatingPool,
    results: PongRankedResult[],
  ): PongRating[] {
    if (results.length < 2)
      throw new Error('Ranked Pong requires at least two players');
    const unique = new Set(results.map((result) => result.userId));
    if (unique.size !== results.length)
      throw new Error('Duplicate ranked player');
    const current = results.map((result) =>
      this.getRating(result.userId, guildId, pool),
    );
    const next = results.map((result, index) => {
      const opponents = results.flatMap((opponentResult, opponentIndex) => {
        if (opponentIndex === index) return [];
        return [
          {
            opponent: current[opponentIndex]!,
            score:
              result.position < opponentResult.position
                ? 1
                : result.position > opponentResult.position
                  ? 0
                  : 0.5,
          },
        ];
      });
      const calculated = calculateGlicko2(current[index]!, opponents);
      return {
        ...current[index]!,
        ...calculated,
        matches: current[index]!.matches + 1,
        wins: current[index]!.wins + (result.position === 1 ? 1 : 0),
      };
    });
    this.database.transaction(() => {
      const now = Date.now();
      for (const rating of next) {
        this.database
          .query(
            `INSERT INTO pong_ratings
             (user_id, guild_id, pool, rating, deviation, volatility, matches, wins, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(user_id, guild_id, pool) DO UPDATE SET
             rating = excluded.rating, deviation = excluded.deviation,
             volatility = excluded.volatility, matches = excluded.matches,
             wins = excluded.wins, updated_at = excluded.updated_at`,
          )
          .run(
            rating.userId,
            guildId,
            pool,
            rating.rating,
            rating.deviation,
            rating.volatility,
            rating.matches,
            rating.wins,
            now,
          );
      }
      this.database
        .query(
          `INSERT INTO pong_ranked_matches
           (id, session_id, guild_id, pool, results_json, played_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(nanoid(), sessionId, guildId, pool, JSON.stringify(results), now);
    })();
    return next;
  }

  leaderboard(guildId: string, pool: PongRatingPool, limit = 50): PongRating[] {
    const rows = this.database
      .query(
        `SELECT user_id FROM pong_ratings
         WHERE guild_id = ? AND pool = ?
         ORDER BY rating DESC, deviation ASC LIMIT ?`,
      )
      .all(guildId, pool, Math.min(Math.max(limit, 1), 100)) as {
      user_id: string;
    }[];
    return rows.map((row) => this.getRating(row.user_id, guildId, pool));
  }
}
