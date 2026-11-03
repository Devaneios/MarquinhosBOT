import type { Db } from '@marquinhos/database/client';
import {
  wordleGlobalAchievements,
  wordleShowcase,
} from '@marquinhos/database/schema';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';

export class InvalidWordleShowcase extends Error {}

export class WordleShowcaseService {
  constructor(private readonly database: Db) {}

  async get(userId: string): Promise<string[]> {
    const rows = await this.database
      .select({ id: wordleShowcase.achievement_id })
      .from(wordleShowcase)
      .where(eq(wordleShowcase.user_id, userId))
      .orderBy(asc(wordleShowcase.slot));
    return rows.map((row) => row.id);
  }

  async replace(userId: string, ids: string[]): Promise<void> {
    if (
      ids.length > 3 ||
      new Set(ids).size !== ids.length ||
      ids.some((id) => !id)
    ) {
      throw new InvalidWordleShowcase('Invalid showcase');
    }
    await this.database.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify(['wordle-showcase', userId])}, 0))`,
      );
      if (ids.length) {
        const owned = await tx
          .select({ id: wordleGlobalAchievements.achievement_id })
          .from(wordleGlobalAchievements)
          .where(
            and(
              eq(wordleGlobalAchievements.user_id, userId),
              inArray(wordleGlobalAchievements.achievement_id, ids),
            ),
          );
        if (owned.length !== ids.length)
          throw new InvalidWordleShowcase('Achievement not unlocked');
      }
      await tx.delete(wordleShowcase).where(eq(wordleShowcase.user_id, userId));
      if (ids.length)
        await tx.insert(wordleShowcase).values(
          ids.map((id, index) => ({
            user_id: userId,
            achievement_id: id,
            slot: index + 1,
            updated_at: Math.floor(Date.now() / 1000),
          })),
        );
    });
  }
}
