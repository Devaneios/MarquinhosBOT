import type {
  PongRating,
  PongRatingPool,
} from '@marquinhos/contracts/http/routes/activity';
import { db as defaultDb } from '@marquinhos/database/sqlite';
import {
  calculateGlicko2,
  type PongRankedResult,
} from '@marquinhos/domain/activity/pong/rating';
import type { Database } from 'bun:sqlite';
import { nanoid } from 'nanoid';

export class PongCompetitionService {
  constructor(private database: Database = defaultDb) {}

  getRating(userId: string, guildId: string, pool: PongRatingPool): PongRating {
    const row = this.database
      .query<
        {
          user_id: string;
          guild_id: string;
          pool: PongRatingPool;
          rating: number;
          deviation: number;
          volatility: number;
          matches: number;
          wins: number;
        },
        [string, string, string]
      >(
        `SELECT user_id, guild_id, pool, rating, deviation, volatility, matches, wins
         FROM pong_ratings WHERE user_id = ? AND guild_id = ? AND pool = ?`,
      )
      .get(userId, guildId, pool);
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
      .query<
        {
          user_id: string;
        },
        [string, string, number]
      >(
        `SELECT user_id FROM pong_ratings
         WHERE guild_id = ? AND pool = ?
         ORDER BY rating DESC, deviation ASC LIMIT ?`,
      )
      .all(guildId, pool, Math.min(Math.max(limit, 1), 100));
    return rows.map((row) => this.getRating(row.user_id, guildId, pool));
  }
}
