import { db } from '@marquinhos/database/client';
import {
  achievements,
  userAchievements,
  userLevels,
} from '@marquinhos/database/schema';
import { WORDLE_ACHIEVEMENT_CATALOG } from '@marquinhos/domain/games/wordle/achievements/catalog';
import { afterAll, describe, expect, it } from 'bun:test';
import { and, eq, inArray } from 'drizzle-orm';
import { AchievementService } from 'services/gamification/AchievementService';
import { LevelingService } from 'services/gamification/LevelingService';

const defaults = new AchievementService(new LevelingService());
const byId = <T extends { id: string }>(rows: readonly T[]) =>
  [...rows].sort((left, right) => left.id.localeCompare(right.id));
const catalogIds = WORDLE_ACHIEVEMENT_CATALOG.map(({ id }) => id);
const operatorAchievement = {
  id: 'operator-owned',
  name: 'Maintained by an operator',
  description: 'Keep this metadata intact.',
  category: 'commands',
  rarity: 'epic',
  icon: '🔧',
  condition: JSON.stringify({ type: 'commands', threshold: 5 }),
  reward_xp: 900,
  archived_at: null,
};

const retiredAchievement = {
  id: 'wordle_v2_retired_example',
  name: 'Removida do catálogo',
  description: 'Não existe mais no código.',
  category: 'wordle',
  rarity: 'rare',
  icon: '🏅',
  condition: null,
  reward_xp: 75,
  archived_at: null,
};
const player = { user_id: 'retirement-user', guild_id: 'retirement-guild' };
const playerFilter = and(
  eq(userAchievements.user_id, player.user_id),
  eq(userAchievements.guild_id, player.guild_id),
);

afterAll(async () => {
  await db.delete(userAchievements).where(playerFilter);
  await db
    .delete(userLevels)
    .where(
      and(
        eq(userLevels.user_id, player.user_id),
        eq(userLevels.guild_id, player.guild_id),
      ),
    );
  await db
    .delete(achievements)
    .where(
      inArray(achievements.id, [operatorAchievement.id, retiredAchievement.id]),
    );
});

describe('Wordle catalog initialization', () => {
  it('seeds all definitions without activation and leaves operator metadata alone', async () => {
    await defaults.initializeDefaults();
    await db
      .insert(achievements)
      .values(operatorAchievement)
      .onConflictDoNothing();
    const once = await db
      .select()
      .from(achievements)
      .where(inArray(achievements.id, catalogIds));
    await defaults.initializeDefaults();
    const twice = await db
      .select()
      .from(achievements)
      .where(inArray(achievements.id, catalogIds));

    expect(WORDLE_ACHIEVEMENT_CATALOG).toHaveLength(110);
    expect(once).toHaveLength(110);
    expect(byId(twice)).toEqual(byId(once));
    expect(
      byId(once).map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        rarity: row.rarity,
        icon: row.icon,
        condition: row.condition,
        reward_xp: row.reward_xp,
        archived_at: row.archived_at,
      })),
    ).toEqual(
      byId(WORDLE_ACHIEVEMENT_CATALOG).map((definition) => ({
        id: definition.id,
        name: definition.name,
        description: definition.description,
        rarity: definition.rarity,
        icon: definition.icon,
        condition: null,
        reward_xp: definition.rewardXp,
        archived_at: null,
      })),
    );

    const [operatorRow] = await db
      .select()
      .from(achievements)
      .where(eq(achievements.id, operatorAchievement.id));
    expect(operatorRow).toEqual(operatorAchievement);
  });

  it('archives Wordle rows missing from the catalog and keeps their unlocks', async () => {
    await defaults.initializeDefaults();
    await db.insert(achievements).values(retiredAchievement);
    await db.insert(userAchievements).values({
      ...player,
      achievement_id: retiredAchievement.id,
      unlocked_at: 1,
    });

    await defaults.initializeDefaults();
    const [archived] = await db
      .select()
      .from(achievements)
      .where(eq(achievements.id, retiredAchievement.id));
    expect(archived?.archived_at).toBeNumber();

    await defaults.initializeDefaults();
    const [repeated] = await db
      .select()
      .from(achievements)
      .where(eq(achievements.id, retiredAchievement.id));
    expect(repeated?.archived_at).toBe(archived!.archived_at);

    const unlocks = await db
      .select({ id: userAchievements.achievement_id })
      .from(userAchievements)
      .where(playerFilter);
    expect(unlocks).toEqual([{ id: retiredAchievement.id }]);
    expect(
      await defaults.unlockAchievement(
        player.user_id,
        player.guild_id,
        retiredAchievement.id,
      ),
    ).toBe(false);

    const [operatorRow] = await db
      .select()
      .from(achievements)
      .where(eq(achievements.id, operatorAchievement.id));
    expect(operatorRow?.archived_at).toBeNull();
  });

  it('restores a returning catalog ID without granting its XP again', async () => {
    const [restored] = WORDLE_ACHIEVEMENT_CATALOG;
    await defaults.initializeDefaults();
    expect(
      await defaults.unlockAchievement(
        player.user_id,
        player.guild_id,
        restored!.id,
      ),
    ).toBe(true);
    const xpBefore = await totalXp();
    await db
      .update(achievements)
      .set({ archived_at: 1 })
      .where(eq(achievements.id, restored!.id));

    await defaults.initializeDefaults();
    const [row] = await db
      .select()
      .from(achievements)
      .where(eq(achievements.id, restored!.id));
    expect(row?.archived_at).toBeNull();
    expect(
      await defaults.unlockAchievement(
        player.user_id,
        player.guild_id,
        restored!.id,
      ),
    ).toBe(false);
    expect(await totalXp()).toBe(xpBefore);
  });
});

async function totalXp() {
  const [row] = await db
    .select({ total: userLevels.total_xp })
    .from(userLevels)
    .where(
      and(
        eq(userLevels.user_id, player.user_id),
        eq(userLevels.guild_id, player.guild_id),
      ),
    );
  return row?.total;
}
