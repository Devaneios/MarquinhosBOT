import { db } from '@marquinhos/database/client';
import { achievements } from '@marquinhos/database/schema';
import { WORDLE_ACHIEVEMENT_CATALOG } from '@marquinhos/domain/games/wordle/achievements/catalog';
import { afterAll, describe, expect, it } from 'bun:test';
import { eq, inArray } from 'drizzle-orm';
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

afterAll(async () => {
  await db
    .delete(achievements)
    .where(eq(achievements.id, operatorAchievement.id));
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
});
