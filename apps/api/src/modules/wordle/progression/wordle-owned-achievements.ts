import type { DbExecutor } from '@marquinhos/database/client';
import {
  achievements,
  userAchievements,
  wordleGlobalAchievements,
} from '@marquinhos/database/schema';
import { and, eq } from 'drizzle-orm';

/**
 * Every Wordle achievement the player holds: global unlocks plus the
 * per-community unlocks kept from before the global game. The overview shows
 * both as unlocked, so anything gated on ownership must accept both.
 */
export async function ownedWordleAchievementIds(
  exec: DbExecutor,
  userId: string,
): Promise<Set<string>> {
  const global = await exec
    .select({ id: wordleGlobalAchievements.achievement_id })
    .from(wordleGlobalAchievements)
    .where(eq(wordleGlobalAchievements.user_id, userId));
  const legacy = await exec
    .select({ id: userAchievements.achievement_id })
    .from(userAchievements)
    .innerJoin(
      achievements,
      eq(userAchievements.achievement_id, achievements.id),
    )
    .where(
      and(
        eq(userAchievements.user_id, userId),
        eq(achievements.category, 'wordle'),
      ),
    );
  return new Set([...global, ...legacy].map((row) => row.id));
}
