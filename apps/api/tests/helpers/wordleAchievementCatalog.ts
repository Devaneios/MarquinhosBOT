import { db } from '@marquinhos/database/client';
import {
  achievements,
  userAchievements,
  userLevels,
  wordleDays,
  wordleSessions,
} from '@marquinhos/database/schema';
import { WORDLE_ACHIEVEMENT_CATALOG } from '@marquinhos/domain/games/wordle/achievements/catalog';
import { randomUUID } from 'crypto';
import { and, eq, inArray } from 'drizzle-orm';
import { AchievementService } from 'services/gamification/AchievementService';
import { LevelingService } from 'services/gamification/LevelingService';
import { activateWordleAchievements } from 'services/wordle/WordleAchievementVersionService';

export async function installWordleAchievementCatalog() {
  const existing = new Set(
    (await db.select().from(achievements)).map((row) => row.id),
  );
  await activateWordleAchievements();
  await new AchievementService(new LevelingService()).initializeDefaults();
  const genericIds = (await db.select().from(achievements))
    .filter((row) => row.category !== 'wordle' && !existing.has(row.id))
    .map((row) => row.id);
  return async () => {
    if (genericIds.length > 0)
      await db.delete(achievements).where(inArray(achievements.id, genericIds));
  };
}

export const identity = () => ({ userId: randomUUID(), guildId: randomUUID() });
export const dateAt = (day: number) =>
  new Date(Date.UTC(2025, 0, day)).toISOString().slice(0, 10);

export async function seedAchievementDay(
  userId: string,
  guildId: string,
  options: {
    date?: string;
    attempts?: number;
    solved?: boolean;
    startedAt?: number;
    solvedAt?: number | null;
    id?: string;
    guesses?: string;
    version?: number;
    word?: string | null;
    width?: number;
  } = {},
) {
  const date = options.date ?? '2026-01-01';
  await db
    .insert(wordleDays)
    .values({
      guild_id: guildId,
      word_date: date,
      word: options.word ?? null,
      word_length: options.width ?? 5,
      is_legacy: true,
      created_at: 0,
    })
    .onConflictDoNothing();
  await db.insert(wordleSessions).values({
    id: options.id ?? randomUUID(),
    user_id: userId,
    guild_id: guildId,
    word_date: date,
    attempts: options.attempts ?? 3,
    solved: options.solved ?? true,
    created_at: options.startedAt ?? 100,
    solved_at: options.solvedAt ?? null,
    guesses: options.guesses ?? '[]',
    achievement_version: options.version ?? 2,
  });
}

export async function seedAchievementDays(
  userId: string,
  guildId: string,
  count: number,
  solved = true,
  attempts = 3,
) {
  for (let index = 1; index <= count; index++)
    await seedAchievementDay(userId, guildId, {
      date: dateAt(index),
      solved,
      attempts,
    });
}

export async function achievementXp(userId: string, guildId: string) {
  const [row] = await db
    .select()
    .from(userLevels)
    .where(
      and(eq(userLevels.user_id, userId), eq(userLevels.guild_id, guildId)),
    );
  return row?.total_xp ?? 0;
}

export function earnedAchievements(userId: string, guildId: string) {
  return db
    .select()
    .from(userAchievements)
    .where(
      and(
        eq(userAchievements.user_id, userId),
        eq(userAchievements.guild_id, guildId),
      ),
    );
}

export function achievementId(
  predicate: (
    rule: (typeof WORDLE_ACHIEVEMENT_CATALOG)[number]['rule'],
  ) => boolean,
) {
  const definition = WORDLE_ACHIEVEMENT_CATALOG.find((row) =>
    predicate(row.rule),
  );
  if (!definition) throw new Error('Required achievement rule is missing');
  return definition.id;
}
