import type { DbExecutor } from '@marquinhos/database/client';
import { wordleSessions, wordleStreaks } from '@marquinhos/database/schema';
import { and, asc, eq, gt, or } from 'drizzle-orm';

export async function updateWordleStreak(
  userId: string,
  guildId: string,
  exec: DbExecutor,
): Promise<number> {
  const rows = await exec
    .select({ date: wordleSessions.word_date })
    .from(wordleSessions)
    .where(
      and(
        eq(wordleSessions.user_id, userId),
        eq(wordleSessions.guild_id, guildId),
        eq(wordleSessions.solved, true),
        or(
          gt(wordleSessions.attempts, 0),
          eq(wordleSessions.solved_from_draft, true),
        ),
      ),
    )
    .orderBy(asc(wordleSessions.word_date));
  const [saved] = await exec
    .select({ max: wordleStreaks.max_streak })
    .from(wordleStreaks)
    .where(
      and(
        eq(wordleStreaks.user_id, userId),
        eq(wordleStreaks.guild_id, guildId),
      ),
    );

  let current = 0;
  let best = Math.max(saved?.max ?? 0, 0);
  let previous: string | undefined;
  let latest: string | null = null;
  for (const { date } of rows) {
    const previousDay = previous ? new Date(`${previous}T00:00:00Z`) : null;
    const currentDay = new Date(`${date}T00:00:00Z`);
    const consecutive =
      previousDay !== null &&
      currentDay.getTime() - previousDay.getTime() === 86_400_000;
    current = consecutive ? current + 1 : 1;
    best = Math.max(best, current);
    previous = date;
    latest = date;
  }
  if (latest === null) return 0;

  await exec
    .insert(wordleStreaks)
    .values({
      user_id: userId,
      guild_id: guildId,
      current_streak: current,
      max_streak: best,
      last_solved_date: latest,
    })
    .onConflictDoUpdate({
      target: [wordleStreaks.user_id, wordleStreaks.guild_id],
      set: {
        current_streak: current,
        max_streak: best,
        last_solved_date: latest,
      },
    });
  return current;
}
