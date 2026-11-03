import type { Db } from '@marquinhos/database/client';
import {
  achievements,
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

  async getIcons(userIds: string[]): Promise<Map<string, string[]>> {
    const icons = new Map<string, string[]>();
    if (!userIds.length) return icons;
    const rows = await this.database
      .select({ userId: wordleShowcase.user_id, icon: achievements.icon })
      .from(wordleShowcase)
      .innerJoin(
        achievements,
        eq(achievements.id, wordleShowcase.achievement_id),
      )
      .where(inArray(wordleShowcase.user_id, userIds))
      .orderBy(asc(wordleShowcase.user_id), asc(wordleShowcase.slot));
    for (const row of rows)
      icons.set(row.userId, [...(icons.get(row.userId) ?? []), row.icon]);
    return icons;
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
