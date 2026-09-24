import type {
  PongRating,
  PongRatingPool,
} from '@marquinhos/contracts/http/routes/activity';
import {
  db as defaultDb,
  type Db,
  type DbExecutor,
} from '@marquinhos/database/client';
import { pongRankedMatches, pongRatings } from '@marquinhos/database/schema';
import {
  calculateGlicko2,
  type PongRankedResult,
} from '@marquinhos/domain/games/pong/rating';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';

const DEFAULT_RATING = { rating: 1500, deviation: 350, volatility: 0.06 };
const MAX_LEADERBOARD_LIMIT = 100;

type RatingRow = typeof pongRatings.$inferSelect;

function toRating(row: RatingRow): PongRating {
  return {
    userId: row.user_id,
    guildId: row.guild_id,
    pool: row.pool as PongRatingPool,
    rating: row.rating,
    deviation: row.deviation,
    volatility: row.volatility,
    matches: row.matches,
    wins: row.wins,
  };
}

function defaultRating(
  userId: string,
  guildId: string,
  pool: PongRatingPool,
): PongRating {
  return { userId, guildId, pool, ...DEFAULT_RATING, matches: 0, wins: 0 };
}

export class PongCompetitionService {
  constructor(private database: Db = defaultDb) {}

  async getRating(
    userId: string,
    guildId: string,
    pool: PongRatingPool,
  ): Promise<PongRating> {
    const [row] = await this.database
      .select()
      .from(pongRatings)
      .where(
        and(
          eq(pongRatings.user_id, userId),
          eq(pongRatings.guild_id, guildId),
          eq(pongRatings.pool, pool),
        ),
      );
    return row ? toRating(row) : defaultRating(userId, guildId, pool);
  }

  async recordMatch(
    sessionId: string,
    guildId: string,
    pool: PongRatingPool,
    results: PongRankedResult[],
  ): Promise<PongRating[]> {
    if (results.length < 2)
      throw new Error('Ranked Pong requires at least two players');
    const unique = new Set(results.map((result) => result.userId));
    if (unique.size !== results.length)
      throw new Error('Duplicate ranked player');

    return this.database.transaction(async (tx) => {
      const now = Date.now();
      const current = await this.lockRatings(
        tx,
        results.map((result) => result.userId),
        guildId,
        pool,
        now,
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

      for (const rating of next) {
        await tx
          .update(pongRatings)
          .set({
            rating: rating.rating,
            deviation: rating.deviation,
            volatility: rating.volatility,
            matches: rating.matches,
            wins: rating.wins,
            updated_at: now,
          })
          .where(
            and(
              eq(pongRatings.user_id, rating.userId),
              eq(pongRatings.guild_id, guildId),
              eq(pongRatings.pool, pool),
            ),
          );
      }
      await tx.insert(pongRankedMatches).values({
        id: nanoid(),
        session_id: sessionId,
        guild_id: guildId,
        pool,
        results_json: JSON.stringify(results),
        played_at: now,
      });
      return next;
    });
  }

  /**
   * Returns the players' ratings in `userIds` order, row-locked so a
   * concurrent match for the same player waits instead of rating from stale
   * values. Missing rows are created first: FOR UPDATE can't lock a row that
   * doesn't exist yet.
   */
  private async lockRatings(
    tx: DbExecutor,
    userIds: string[],
    guildId: string,
    pool: PongRatingPool,
    now: number,
  ): Promise<PongRating[]> {
    // Rows are inserted and locked in one stable order, so two matches that
    // share players can't each hold a row the other one needs.
    const ordered = [...userIds].sort();
    await tx
      .insert(pongRatings)
      .values(
        ordered.map((userId) => ({
          user_id: userId,
          guild_id: guildId,
          pool,
          ...DEFAULT_RATING,
          updated_at: now,
        })),
      )
      .onConflictDoNothing();
    const rows = await tx
      .select()
      .from(pongRatings)
      .where(
        and(
          inArray(pongRatings.user_id, userIds),
          eq(pongRatings.guild_id, guildId),
          eq(pongRatings.pool, pool),
        ),
      )
      .orderBy(asc(pongRatings.user_id))
      .for('update');
    const byUser = new Map(rows.map((row) => [row.user_id, toRating(row)]));
    return userIds.map((userId) => byUser.get(userId)!);
  }

  async leaderboard(
    guildId: string,
    pool: PongRatingPool,
    limit = 50,
  ): Promise<PongRating[]> {
    const rows = await this.database
      .select()
      .from(pongRatings)
      .where(and(eq(pongRatings.guild_id, guildId), eq(pongRatings.pool, pool)))
      .orderBy(desc(pongRatings.rating), asc(pongRatings.deviation))
      .limit(Math.min(Math.max(limit, 1), MAX_LEADERBOARD_LIMIT));
    return rows.map(toRating);
  }
}
