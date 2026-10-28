import { db } from '@marquinhos/database/client';
import {
  achievements,
  userAchievements,
  userLevels,
  wordleAchievementVersions,
  wordleDays,
  wordlePatternDiscoveries,
  wordleSessions,
} from '@marquinhos/database/schema';
import {
  WORDLE_ACHIEVEMENT_CATALOG,
  WORDLE_ACHIEVEMENT_CATALOG_REVISION,
} from '@marquinhos/domain/games/wordle/achievements/catalog';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'bun:test';
import { randomUUID } from 'crypto';
import { eq, inArray } from 'drizzle-orm';
import { AchievementService } from 'services/gamification/AchievementService';
import { LevelingService } from 'services/gamification/LevelingService';
import { WordleService } from 'services/wordle';
import { WordleAchievementService } from 'services/wordle/WordleAchievementService';
import {
  activateWordleAchievements,
  getActiveWordleAchievementVersion,
  inspectWordleAchievementActivation,
} from 'services/wordle/WordleAchievementVersionService';
import { getRecifeDate } from 'services/wordle/wordleDate';

const service = new WordleAchievementService();
const generic = new AchievementService(new LevelingService());

let existingGenericIds: Set<string>;
beforeAll(async () => {
  existingGenericIds = new Set(
    (await db.select().from(achievements))
      .filter((row) => row.category !== 'wordle')
      .map((row) => row.id),
  );
});
afterAll(async () => {
  const added = (await db.select().from(achievements))
    .filter(
      (row) => row.category !== 'wordle' && !existingGenericIds.has(row.id),
    )
    .map((row) => row.id);
  if (added.length > 0)
    await db.delete(achievements).where(inArray(achievements.id, added));
});

beforeEach(async () => {
  await db.transaction(async (tx) => {
    await tx.update(wordleAchievementVersions).set({ active: false });
    await tx
      .insert(wordleAchievementVersions)
      .values({ version: 1, active: true, activated_at: 1 })
      .onConflictDoUpdate({
        target: wordleAchievementVersions.version,
        set: { active: true },
      });
  });
});

async function board(userId: string, guildId: string, date = getRecifeDate()) {
  await db
    .insert(wordleDays)
    .values({
      guild_id: guildId,
      word_date: date,
      word: 'termo',
      word_length: 5,
      created_at: 0,
    })
    .onConflictDoNothing();
  await db.insert(wordleSessions).values({
    id: randomUUID(),
    user_id: userId,
    guild_id: guildId,
    word_date: date,
    guesses: JSON.stringify([
      {
        guess: 'gatos',
        feedback: ['absent', 'absent', 'present', 'correct', 'absent'],
      },
    ]),
    attempts: 1,
    created_at: 1,
  });
}

describe('Wordle achievement activation boundary', () => {
  it('inspection and incompatible startup preserve the boundary and do not publish v2', async () => {
    const before = await db.select().from(wordleAchievementVersions);
    const inspection = await inspectWordleAchievementActivation();
    expect(inspection).toMatchObject({ currentVersion: 1, proposedVersion: 2 });
    const definitionsBefore = await db
      .select()
      .from(achievements)
      .where(eq(achievements.wordle_version, 2));
    await generic.initializeDefaults();
    expect(
      await db
        .select()
        .from(achievements)
        .where(eq(achievements.wordle_version, 2)),
    ).toEqual(definitionsBefore);
    expect(await db.select().from(wordleAchievementVersions)).toEqual(before);
    expect(await getActiveWordleAchievementVersion(db)).toBe(1);
    const { userId, guildId } = { userId: randomUUID(), guildId: randomUUID() };
    await board(userId, guildId);
    const overview = await service.getOverview(userId, guildId);
    expect(overview.achievements).toHaveLength(0);
    expect(overview.stats.played).toBe(1);
    expect(
      (await db.transaction((tx) => service.checkAndAward(userId, guildId, tx)))
        .unlockedAchievements,
    ).toEqual([]);
  });

  it('archives only Wordle and starts zero while preserving history, unlocks, XP and lifetime best', async () => {
    const userId = randomUUID(),
      guildId = randomUUID(),
      oldId = `legacy-${randomUUID()}`,
      customId = randomUUID();
    await board(userId, guildId, '2026-01-01');
    await db.insert(achievements).values([
      {
        id: oldId,
        name: 'old',
        description: '',
        category: 'wordle',
        rarity: 'common',
        icon: '',
        condition: '{}',
        reward_xp: 25,
        wordle_version: 1,
      },
      {
        id: customId,
        name: 'custom',
        description: '',
        category: 'custom',
        rarity: 'common',
        icon: '',
        condition: JSON.stringify({ type: 'commands', threshold: 99999999 }),
        reward_xp: 0,
      },
    ]);
    await db.insert(userAchievements).values({
      user_id: userId,
      guild_id: guildId,
      achievement_id: oldId,
      unlocked_at: 1,
    });
    await db
      .insert(userLevels)
      .values({ user_id: userId, guild_id: guildId, total_xp: 123, xp: 123 });
    const before = await service.getOverview(userId, guildId);
    await activateWordleAchievements();
    const after = await service.getOverview(userId, guildId);
    expect(after.achievementVersion).toBe(2);
    expect(after.stats).toEqual(before.stats);
    expect(after.achievements).toHaveLength(WORDLE_ACHIEVEMENT_CATALOG.length);
    expect(
      after.achievements.every(
        (row) =>
          row.unlockedAt === null &&
          (row.progress === null || row.progress.current === 0) &&
          row.holdersPercent === null,
      ),
    ).toBe(true);
    expect(
      await db
        .select()
        .from(userAchievements)
        .where(eq(userAchievements.achievement_id, oldId)),
    ).toHaveLength(1);
    expect(
      (
        await db.select().from(userLevels).where(eq(userLevels.user_id, userId))
      )[0]?.total_xp,
    ).toBe(123);
    expect(
      (await generic.getAllAchievements()).some((row) => row.id === oldId),
    ).toBe(false);
    expect(await generic.getUserAchievements(userId, guildId)).toEqual([]);
    expect(await generic.unlockAchievement(randomUUID(), guildId, oldId)).toBe(
      false,
    );
    expect(
      (await generic.getAllAchievements()).some((row) => row.id === customId),
    ).toBe(true);
    await service.backfill({ guildId });
    expect(
      await db
        .select()
        .from(wordlePatternDiscoveries)
        .where(eq(wordlePatternDiscoveries.guild_id, guildId)),
    ).toEqual([]);
    await db.delete(achievements).where(eq(achievements.id, customId));
  });

  it('activation retires current-version definitions missing from the catalog and reports them', async () => {
    const before = await inspectWordleAchievementActivation();
    const [omitted] = await db
      .insert(achievements)
      .values({
        id: `wordle_v2_removed_${randomUUID()}`,
        name: 'Removida',
        description: 'Fora do catálogo atual.',
        category: 'wordle',
        rarity: 'common',
        icon: '🏅',
        condition: JSON.stringify({ kind: 'wins', count: 1 }),
        reward_xp: 25,
        wordle_version: 2,
      })
      .returning();
    if (!omitted) throw new Error('Missing seeded achievement');
    try {
      expect(
        (await inspectWordleAchievementActivation()).definitionsToArchive,
      ).toBe(before.definitionsToArchive + 1);
      expect(await activateWordleAchievements()).toMatchObject({
        catalogRevision: WORDLE_ACHIEVEMENT_CATALOG_REVISION,
      });
      const [retired] = await db
        .select()
        .from(achievements)
        .where(eq(achievements.id, omitted.id));
      expect(retired?.archived_at).toBeNumber();
    } finally {
      await db.delete(achievements).where(eq(achievements.id, omitted.id));
    }
  });

  it('activation retries preserve the activation record and earned progress', async () => {
    await activateWordleAchievements();
    const userId = randomUUID(),
      guildId = randomUUID();
    await db.insert(wordleDays).values({
      guild_id: guildId,
      word_date: getRecifeDate(),
      word: 'termo',
      word_length: 5,
      created_at: 0,
    });
    const result = await new WordleService().submitGuess(
      userId,
      guildId,
      'termo',
    );
    if ('error' in result) throw new Error(result.error);
    const earned = await db
      .select()
      .from(userAchievements)
      .where(eq(userAchievements.user_id, userId));
    const discoveries = await db
      .select()
      .from(wordlePatternDiscoveries)
      .where(eq(wordlePatternDiscoveries.user_id, userId));
    const before = await db
      .select()
      .from(wordleAchievementVersions)
      .where(eq(wordleAchievementVersions.version, 2));
    await Promise.all([
      activateWordleAchievements(),
      activateWordleAchievements(),
    ]);
    expect(
      await db
        .select()
        .from(wordleAchievementVersions)
        .where(eq(wordleAchievementVersions.version, 2)),
    ).toEqual(before);
    expect(
      await db
        .select()
        .from(userAchievements)
        .where(eq(userAchievements.user_id, userId)),
    ).toEqual(earned);
    expect(
      await db
        .select()
        .from(wordlePatternDiscoveries)
        .where(eq(wordlePatternDiscoveries.user_id, userId)),
    ).toEqual(discoveries);
  });

  it('keeps pre-activation boards in v1 even when solved after activation and stamps new sessions v2', async () => {
    const userId = randomUUID(),
      guildId = randomUUID();
    await board(userId, guildId);
    await activateWordleAchievements();
    const old = await new WordleService().submitGuess(userId, guildId, 'termo');
    if ('error' in old) throw new Error(old.error);
    expect(old).toMatchObject({
      solved: true,
      achievementVersion: 2,
      unlockedAchievements: [],
    });
    expect(old.achievements?.every((row) => row.unlockedAt === null)).toBe(
      true,
    );
    const newcomer = randomUUID();
    const fresh = await new WordleService().submitGuess(
      newcomer,
      guildId,
      'termo',
    );
    if ('error' in fresh) throw new Error(fresh.error);
    expect(fresh.unlockedAchievements?.length).toBeGreaterThan(0);
    const sessions = await db
      .select()
      .from(wordleSessions)
      .where(eq(wordleSessions.guild_id, guildId));
    expect(
      sessions.find((row) => row.user_id === userId)?.achievement_version,
    ).toBe(1);
    expect(
      sessions.find((row) => row.user_id === newcomer)?.achievement_version,
    ).toBe(2);
    expect(
      (await service.loadHistory(newcomer, guildId)).days[0]
        ?.firstSolverInGuild,
    ).toBe(false);
  });

  it('shared readers keep activation waiting and first-guess stamping observes one boundary', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let acquired!: () => void;
    const locked = new Promise<void>((resolve) => {
      acquired = resolve;
    });
    const reader = db.transaction(async (tx) => {
      expect(await getActiveWordleAchievementVersion(tx, 'share')).toBe(1);
      acquired();
      await gate;
    });
    await locked;
    let activated = false;
    const activation = activateWordleAchievements().then(() => {
      activated = true;
    });
    try {
      await new Promise((resolve) => setTimeout(resolve, 30));
      expect(activated).toBe(false);
    } finally {
      release();
    }
    await Promise.all([reader, activation]);
    expect(await getActiveWordleAchievementVersion(db)).toBe(2);
  });
  it('races activation and a first guess without changing the session stamp afterward', async () => {
    const userId = randomUUID(),
      guildId = randomUUID();
    await db.insert(wordleDays).values({
      guild_id: guildId,
      word_date: getRecifeDate(),
      word: 'termo',
      word_length: 5,
      created_at: 0,
    });
    const [, guess] = await Promise.all([
      activateWordleAchievements(),
      new WordleService().submitGuess(userId, guildId, 'gatos'),
    ]);
    if ('error' in guess) throw new Error(guess.error);
    const [before] = await db
      .select()
      .from(wordleSessions)
      .where(eq(wordleSessions.user_id, userId));
    if (!before) throw new Error('Accepted guess did not create a session');
    expect([1, 2]).toContain(before.achievement_version);
    const solved = await new WordleService().submitGuess(
      userId,
      guildId,
      'termo',
    );
    if ('error' in solved) throw new Error(solved.error);
    const [after] = await db
      .select()
      .from(wordleSessions)
      .where(eq(wordleSessions.user_id, userId));
    expect(after?.achievement_version).toBe(before?.achievement_version);
    expect(solved.achievementVersion).toBe(2);
    if (after?.achievement_version === 1)
      expect(solved.unlockedAchievements).toEqual([]);
    else expect(solved.unlockedAchievements?.length).toBeGreaterThan(0);
  });

  it('CLI defaults to a read-only inspection and rejects accidental activation arguments', async () => {
    const before = await db.select().from(wordleAchievementVersions);
    const inspect = Bun.spawn(
      ['bun', 'scripts/activateWordleAchievements.ts'],
      { cwd: process.cwd(), env: process.env, stdout: 'pipe', stderr: 'pipe' },
    );
    const report = JSON.parse(await new Response(inspect.stdout).text());
    expect(await inspect.exited).toBe(0);
    expect(report).toMatchObject({
      mode: 'inspection',
      currentVersion: 1,
      proposedVersion: 2,
    });
    expect(await db.select().from(wordleAchievementVersions)).toEqual(before);
    const accidental = Bun.spawn(
      ['bun', 'scripts/activateWordleAchievements.ts', '--yes'],
      { cwd: process.cwd(), env: process.env, stdout: 'pipe', stderr: 'pipe' },
    );
    expect(await accidental.exited).toBe(1);
    expect(await db.select().from(wordleAchievementVersions)).toEqual(before);
    const apply = Bun.spawn(
      ['bun', 'scripts/activateWordleAchievements.ts', '--apply'],
      { cwd: process.cwd(), env: process.env, stdout: 'pipe', stderr: 'pipe' },
    );
    const activated = JSON.parse(await new Response(apply.stdout).text());
    expect(await apply.exited).toBe(0);
    expect(activated).toMatchObject({
      mode: 'apply',
      currentVersion: 2,
      alreadyActive: true,
    });
    expect(await getActiveWordleAchievementVersion(db)).toBe(2);
  });
});
