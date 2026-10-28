import { db } from '@marquinhos/database/client';
import {
  achievements,
  userAchievements,
  userLevels,
  wordleAchievementVersions,
  wordlePatternDiscoveries,
} from '@marquinhos/database/schema';
import {
  WORDLE_ACHIEVEMENT_CATALOG,
  WORDLE_ACHIEVEMENT_CATALOG_REVISION,
  WORDLE_ACHIEVEMENT_VERSION,
} from '@marquinhos/domain/games/wordle/achievements/catalog';
import { beforeEach, describe, expect, it } from 'bun:test';
import { randomUUID } from 'crypto';
import { eq, inArray, sql } from 'drizzle-orm';
import { AchievementService } from 'services/gamification/AchievementService';
import { LevelingService } from 'services/gamification/LevelingService';
import { WordleAchievementService } from 'services/wordle/WordleAchievementService';
import {
  activateWordleAchievements,
  getActiveWordleAchievementVersion,
  syncCompatibleWordleCatalog,
} from 'services/wordle/WordleAchievementVersionService';

const awards = new AchievementService(new LevelingService());
const wordle = new WordleAchievementService();
const sync = () => syncCompatibleWordleCatalog(db);
const setCatalogRevision = (catalog_revision: number) =>
  db
    .update(wordleAchievementVersions)
    .set({ catalog_revision })
    .where(eq(wordleAchievementVersions.version, WORDLE_ACHIEVEMENT_VERSION));

beforeEach(async () => {
  await activateWordleAchievements();
  await awards.initializeDefaults();
});

async function seedDefinition(
  overrides: Partial<typeof achievements.$inferInsert> = {},
) {
  const [definition] = await db
    .insert(achievements)
    .values({
      id: `wordle_v2_retired_${randomUUID()}`,
      name: 'Desafio retirado',
      description: 'Uma conquista removida do catálogo.',
      category: 'wordle',
      rarity: 'rare',
      icon: '🏅',
      condition: JSON.stringify({ kind: 'wins', count: 1 }),
      reward_xp: 75,
      wordle_version: 2,
      ...overrides,
    })
    .returning();
  if (!definition) throw new Error('Missing seeded achievement');
  return definition;
}

async function playerHistory(userId: string) {
  return {
    unlocks: await db
      .select()
      .from(userAchievements)
      .where(eq(userAchievements.user_id, userId)),
    discoveries: await db
      .select()
      .from(wordlePatternDiscoveries)
      .where(eq(wordlePatternDiscoveries.user_id, userId)),
    levels: await db
      .select()
      .from(userLevels)
      .where(eq(userLevels.user_id, userId)),
  };
}

async function waitForBlockedConnection(blockerPid: number) {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const [connection] = await db.execute<{ pid: number }>(sql`
      SELECT pid FROM pg_stat_activity
      WHERE datname = current_database()
        AND ${blockerPid} = ANY(pg_blocking_pids(pid))
      LIMIT 1
    `);
    if (connection) return connection.pid;
    await Bun.sleep(10);
  }
  throw new Error('Expected a connection waiting for the version lock');
}

describe('Wordle catalog retirement', () => {
  it('records the catalog revision it synchronized', async () => {
    await setCatalogRevision(0);
    expect(await sync()).toBe(true);
    const [record] = await db
      .select()
      .from(wordleAchievementVersions)
      .where(eq(wordleAchievementVersions.version, WORDLE_ACHIEVEMENT_VERSION));
    expect(record?.catalog_revision).toBe(WORDLE_ACHIEVEMENT_CATALOG_REVISION);
  });

  it('skips a stale catalog without undoing the newer one', async () => {
    const omitted = await seedDefinition();
    const current = WORDLE_ACHIEVEMENT_CATALOG[0];
    if (!current) throw new Error('Missing current achievement');
    await db
      .update(achievements)
      .set({ archived_at: 123, name: 'Edited by a newer deploy' })
      .where(eq(achievements.id, current.id));
    await setCatalogRevision(WORDLE_ACHIEVEMENT_CATALOG_REVISION + 1);
    const read = () =>
      db
        .select()
        .from(achievements)
        .where(inArray(achievements.id, [omitted.id, current.id]))
        .orderBy(achievements.id);
    const before = await read();
    try {
      expect(await sync()).toBe(false);
      expect(await read()).toEqual(before);
      await expect(activateWordleAchievements()).resolves.toMatchObject({
        catalogRevision: WORDLE_ACHIEVEMENT_CATALOG_REVISION + 1,
      });
    } finally {
      await setCatalogRevision(WORDLE_ACHIEVEMENT_CATALOG_REVISION);
      await sync();
    }
  });

  it('archives omitted definitions while preserving earned history and XP', async () => {
    const definition = await seedDefinition();
    const userId = randomUUID();
    const guildId = randomUUID();
    expect(await awards.unlockAchievement(userId, guildId, definition.id)).toBe(
      true,
    );
    await db.insert(wordlePatternDiscoveries).values({
      user_id: userId,
      guild_id: guildId,
      version: 2,
      pattern_id: 'retired_pattern',
      session_id: randomUUID(),
      discovered_at: 123,
      evidence: {
        patternId: 'retired_pattern',
        color: 'correct',
        origin: [0, 0],
        rotation: 0,
        cells: [[0, 0]],
        feedback: [['correct']],
        date: '2026-01-01',
      },
    });
    const before = await playerHistory(userId);

    expect(await sync()).toBe(true);

    const [retired] = await db
      .select()
      .from(achievements)
      .where(eq(achievements.id, definition.id));
    expect(retired?.archived_at).toBeNumber();
    expect(await playerHistory(userId)).toEqual(before);
    expect(
      (await awards.getAllAchievements()).some(
        (row) => row.id === definition.id,
      ),
    ).toBe(false);
    expect(await awards.getUserAchievements(userId, guildId)).toEqual([]);
    expect(
      (await wordle.getAchievements(userId, guildId)).some(
        (row) => row.id === definition.id,
      ),
    ).toBe(false);
    expect(
      await awards.unlockAchievement(randomUUID(), guildId, definition.id),
    ).toBe(false);
  });

  it('rejects a direct unlock that waited behind retirement', async () => {
    const definition = await seedDefinition();
    const userId = randomUUID();
    const guildId = randomUUID();
    const locked = Promise.withResolvers<number>();
    const retire = Promise.withResolvers<void>();
    const retirement = db.transaction(async (tx) => {
      await getActiveWordleAchievementVersion(tx, 'update');
      const [connection] = await tx.execute<{ pid: number }>(
        sql`SELECT pg_backend_pid() AS pid`,
      );
      if (!connection) throw new Error('Missing retirement connection');
      locked.resolve(connection.pid);
      await retire.promise;
      await tx
        .update(achievements)
        .set({ archived_at: 123 })
        .where(eq(achievements.id, definition.id));
    });
    const blockerPid = await locked.promise;
    const unlock = awards.unlockAchievement(userId, guildId, definition.id);
    try {
      await waitForBlockedConnection(blockerPid);
    } finally {
      retire.resolve();
      await retirement;
    }
    expect(await unlock).toBe(false);
    expect(await playerHistory(userId)).toEqual({
      unlocks: [],
      discoveries: [],
      levels: [],
    });
  });

  it('keeps the first retirement timestamp across repeated and concurrent syncs', async () => {
    const definition = await seedDefinition();
    await sync();
    const before = await db
      .select()
      .from(achievements)
      .where(eq(achievements.id, definition.id));
    expect(before[0]?.archived_at).toBeNumber();
    expect(await Promise.all([sync(), sync()])).toEqual([true, true]);
    expect(
      await db
        .select()
        .from(achievements)
        .where(eq(achievements.id, definition.id)),
    ).toEqual(before);
  });

  it('leaves other categories, versions, and previously archived rows untouched', async () => {
    const definitions = await Promise.all([
      seedDefinition({ category: 'commands' }),
      seedDefinition({ wordle_version: 1 }),
      seedDefinition({ wordle_version: 3 }),
      seedDefinition({ wordle_version: null }),
      seedDefinition({ archived_at: 123 }),
    ]);
    const ids = definitions.map((definition) => definition.id);
    const read = () =>
      db
        .select()
        .from(achievements)
        .where(inArray(achievements.id, ids))
        .orderBy(achievements.id);
    const before = await read();
    await sync();
    expect(await read()).toEqual(before);
  });

  it('restores a listed ID with its existing unlock and no second XP award', async () => {
    const definition = WORDLE_ACHIEVEMENT_CATALOG[0];
    if (!definition) throw new Error('Missing current achievement');
    const userId = randomUUID();
    const guildId = randomUUID();
    expect(await awards.unlockAchievement(userId, guildId, definition.id)).toBe(
      true,
    );
    const before = await playerHistory(userId);
    await db
      .update(achievements)
      .set({ archived_at: 123, name: 'Previously retired' })
      .where(eq(achievements.id, definition.id));

    await sync();

    const [restored] = await db
      .select()
      .from(achievements)
      .where(eq(achievements.id, definition.id));
    expect(restored).toMatchObject({
      archived_at: null,
      name: definition.name,
      condition: JSON.stringify(definition.rule),
    });
    expect(await awards.unlockAchievement(userId, guildId, definition.id)).toBe(
      false,
    );
    expect(await playerHistory(userId)).toEqual(before);
    expect(
      (await wordle.getAchievements(userId, guildId)).find(
        (row) => row.id === definition.id,
      )?.unlockedAt,
    ).toBeString();
  });

  it('does not mutate definitions when the active version is incompatible', async () => {
    await seedDefinition();
    const current = WORDLE_ACHIEVEMENT_CATALOG[0];
    if (!current) throw new Error('Missing current achievement');
    await db
      .update(achievements)
      .set({ archived_at: 123, name: 'Keep until compatible' })
      .where(eq(achievements.id, current.id));
    await db.transaction(async (tx) => {
      await getActiveWordleAchievementVersion(tx, 'update');
      await tx
        .update(wordleAchievementVersions)
        .set({ active: false })
        .where(eq(wordleAchievementVersions.active, true));
      await tx
        .update(wordleAchievementVersions)
        .set({ active: true })
        .where(eq(wordleAchievementVersions.version, 1));
    });
    const before = await db
      .select()
      .from(achievements)
      .orderBy(achievements.id);
    try {
      expect(await sync()).toBe(false);
      expect(
        await db.select().from(achievements).orderBy(achievements.id),
      ).toEqual(before);
    } finally {
      await activateWordleAchievements();
    }
  });

  it('rolls back catalog upserts and retirement together', async () => {
    const omitted = await seedDefinition();
    const current = WORDLE_ACHIEVEMENT_CATALOG[0];
    if (!current) throw new Error('Missing current achievement');
    await db
      .update(achievements)
      .set({ archived_at: 123, name: 'Before rolled-back sync' })
      .where(eq(achievements.id, current.id));
    const ids = [omitted.id, current.id];
    const read = () =>
      db
        .select()
        .from(achievements)
        .where(inArray(achievements.id, ids))
        .orderBy(achievements.id);
    const before = await read();
    await expect(
      db.transaction(async (tx) => {
        expect(await syncCompatibleWordleCatalog(tx)).toBe(true);
        throw new Error('Abort catalog transaction');
      }),
    ).rejects.toThrow('Abort catalog transaction');
    expect(await read()).toEqual(before);
  });

  it('rolls back a direct unlock when its XP update fails', async () => {
    const definition = await seedDefinition();
    const userId = randomUUID();
    const guildId = randomUUID();
    await db.insert(userLevels).values({
      user_id: userId,
      guild_id: guildId,
      total_xp: 2_147_483_647,
    });
    const before = await playerHistory(userId);
    await expect(
      awards.unlockAchievement(userId, guildId, definition.id),
    ).rejects.toThrow();
    expect(await playerHistory(userId)).toEqual(before);
  });

  it('lets an in-flight direct award finish before retirement can commit', async () => {
    const definition = await seedDefinition();
    const userId = randomUUID();
    const guildId = randomUUID();
    await new LevelingService().ensureUser(userId, guildId);
    const locked = Promise.withResolvers<number>();
    const releaseXp = Promise.withResolvers<void>();
    const xpLock = db.transaction(async (tx) => {
      await tx
        .select()
        .from(userLevels)
        .where(eq(userLevels.user_id, userId))
        .for('update');
      const [connection] = await tx.execute<{ pid: number }>(
        sql`SELECT pg_backend_pid() AS pid`,
      );
      if (!connection) throw new Error('Missing XP lock connection');
      locked.resolve(connection.pid);
      await releaseXp.promise;
    });
    const blockerPid = await locked.promise;
    const unlock = awards.unlockAchievement(userId, guildId, definition.id);
    let retirement: Promise<boolean> | undefined;
    try {
      const awardPid = await waitForBlockedConnection(blockerPid);
      retirement = syncCompatibleWordleCatalog(db);
      await waitForBlockedConnection(awardPid);
      expect((await playerHistory(userId)).unlocks).toEqual([]);
    } finally {
      releaseXp.resolve();
      await xpLock;
      await Promise.allSettled([unlock, retirement]);
    }
    expect(await unlock).toBe(true);
    expect(await retirement).toBe(true);
    const history = await playerHistory(userId);
    expect(history.unlocks).toHaveLength(1);
    expect(history.levels[0]?.total_xp).toBe(75);
    const [retired] = await db
      .select()
      .from(achievements)
      .where(eq(achievements.id, definition.id));
    expect(retired?.archived_at).toBeNumber();
  });
});
