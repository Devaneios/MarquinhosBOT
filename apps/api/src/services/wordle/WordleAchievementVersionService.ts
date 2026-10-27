import { db, type DbExecutor } from '@marquinhos/database/client';
import {
  achievements,
  userAchievements,
  wordleAchievementVersions,
  wordleSessions,
} from '@marquinhos/database/schema';
import {
  WORDLE_ACHIEVEMENT_CATALOG,
  WORDLE_ACHIEVEMENT_VERSION,
} from '@marquinhos/domain/games/wordle/achievements/catalog';
import { and, count, eq, isNull, ne, or, sql } from 'drizzle-orm';

export async function getActiveWordleAchievementVersion(
  exec: DbExecutor,
  lock?: 'share' | 'update',
): Promise<number> {
  // Version 1 is the permanent lock anchor. The active row can change while a
  // reader waits, so locking only a WHERE active row could return no version.
  if (lock) {
    const anchors = await exec
      .select({ version: wordleAchievementVersions.version })
      .from(wordleAchievementVersions)
      .where(eq(wordleAchievementVersions.version, 1))
      .for(lock);
    if (anchors.length !== 1)
      throw new Error(
        'Wordle achievement version 1 is missing; run migrations',
      );
  }
  const [active] = await exec
    .select({ version: wordleAchievementVersions.version })
    .from(wordleAchievementVersions)
    .where(eq(wordleAchievementVersions.active, true));
  if (!active)
    throw new Error('No active Wordle achievement version; run migrations');
  return active.version;
}

async function seedCatalog(exec: DbExecutor) {
  await exec
    .insert(achievements)
    .values(
      WORDLE_ACHIEVEMENT_CATALOG.map((definition) => ({
        id: definition.id,
        name: definition.name,
        description: definition.description,
        category: 'wordle',
        rarity: definition.rarity,
        icon: definition.icon,
        condition: JSON.stringify(definition.rule),
        reward_xp: definition.rewardXp,
        wordle_version: WORDLE_ACHIEVEMENT_VERSION,
        archived_at: null,
      })),
    )
    .onConflictDoUpdate({
      target: achievements.id,
      set: {
        name: sql`excluded.name`,
        description: sql`excluded.description`,
        category: sql`excluded.category`,
        rarity: sql`excluded.rarity`,
        icon: sql`excluded.icon`,
        condition: sql`excluded.condition`,
        reward_xp: sql`excluded.reward_xp`,
        wordle_version: sql`excluded.wordle_version`,
        archived_at: null,
      },
    });
}

export async function syncCompatibleWordleCatalog(
  exec: DbExecutor,
): Promise<boolean> {
  if (
    (await getActiveWordleAchievementVersion(exec, 'share')) !==
    WORDLE_ACHIEVEMENT_VERSION
  )
    return false;
  await seedCatalog(exec);
  return true;
}

export async function inspectWordleAchievementActivation(
  exec: DbExecutor = db,
) {
  const currentVersion = await getActiveWordleAchievementVersion(exec);
  const oldDefinitions = and(
    eq(achievements.category, 'wordle'),
    or(
      isNull(achievements.wordle_version),
      ne(achievements.wordle_version, WORDLE_ACHIEVEMENT_VERSION),
    ),
  );
  const [entries] = await exec
    .select({ count: count() })
    .from(achievements)
    .where(and(oldDefinitions, isNull(achievements.archived_at)));
  const [unlocks] = await exec
    .select({ count: count() })
    .from(userAchievements)
    .innerJoin(
      achievements,
      eq(achievements.id, userAchievements.achievement_id),
    )
    .where(oldDefinitions);
  const sessions = await exec
    .select({ version: wordleSessions.achievement_version, count: count() })
    .from(wordleSessions)
    .groupBy(wordleSessions.achievement_version);
  const [record] = await exec
    .select()
    .from(wordleAchievementVersions)
    .where(eq(wordleAchievementVersions.version, WORDLE_ACHIEVEMENT_VERSION));
  return {
    currentVersion,
    proposedVersion: WORDLE_ACHIEVEMENT_VERSION,
    alreadyActive: currentVersion === WORDLE_ACHIEVEMENT_VERSION,
    activatedAt: record?.activated_at ?? null,
    definitionsToArchive: entries?.count ?? 0,
    unlocksPreserved: unlocks?.count ?? 0,
    proposedDefinitions: WORDLE_ACHIEVEMENT_CATALOG.length,
    sessionsByVersion: sessions,
    sessionBoundary:
      'Existing sessions keep their recorded version. Only new sessions accepted after activation enter the new collection.',
  };
}

export async function activateWordleAchievements() {
  return db.transaction(async (tx) => {
    const current = await getActiveWordleAchievementVersion(tx, 'update');
    if (current > WORDLE_ACHIEVEMENT_VERSION)
      throw new Error(
        `Refusing Wordle achievement downgrade from ${current} to ${WORDLE_ACHIEVEMENT_VERSION}`,
      );
    if (current === WORDLE_ACHIEVEMENT_VERSION)
      return inspectWordleAchievementActivation(tx);
    const now = Date.now();
    await tx
      .update(achievements)
      .set({ archived_at: now })
      .where(
        and(
          eq(achievements.category, 'wordle'),
          isNull(achievements.archived_at),
          or(
            isNull(achievements.wordle_version),
            ne(achievements.wordle_version, WORDLE_ACHIEVEMENT_VERSION),
          ),
        ),
      );
    await seedCatalog(tx);
    await tx
      .update(wordleAchievementVersions)
      .set({ active: false })
      .where(eq(wordleAchievementVersions.active, true));
    await tx
      .insert(wordleAchievementVersions)
      .values({
        version: WORDLE_ACHIEVEMENT_VERSION,
        active: true,
        activated_at: now,
      })
      .onConflictDoUpdate({
        target: wordleAchievementVersions.version,
        set: { active: true },
      });
    return inspectWordleAchievementActivation(tx);
  });
}
