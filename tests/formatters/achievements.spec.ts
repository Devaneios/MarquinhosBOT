import { describe, expect, test } from 'bun:test';
import { groupByRarity, RARITY_ORDER, RARITY_LABELS } from '@marquinhos/formatters/achievements';
import { UserAchievement } from '@marquinhos/types';

const makeAchievement = (rarity: UserAchievement['rarity']): UserAchievement => ({
  userId: '1',
  guildId: '1',
  achievementId: 'a',
  unlockedAt: new Date(),
  name: 'Test',
  description: 'Desc',
  category: 'general',
  rarity,
  icon: '🏆',
  rewardXp: 0,
});

describe('groupByRarity', () => {
  test('groups achievements into correct buckets', () => {
    const items = [
      makeAchievement('legendary'),
      makeAchievement('common'),
      makeAchievement('legendary'),
    ];
    const result = groupByRarity(items);
    expect(result.legendary).toHaveLength(2);
    expect(result.common).toHaveLength(1);
    expect(result.epic).toHaveLength(0);
    expect(result.rare).toHaveLength(0);
  });

  test('returns empty buckets when input is empty', () => {
    const result = groupByRarity([]);
    for (const rarity of RARITY_ORDER) {
      expect(result[rarity]).toHaveLength(0);
    }
  });
});

describe('RARITY_ORDER', () => {
  test('has legendary first', () => {
    expect(RARITY_ORDER[0]).toBe('legendary');
  });
});

describe('RARITY_LABELS', () => {
  test('has a label for every rarity', () => {
    for (const rarity of RARITY_ORDER) {
      expect(RARITY_LABELS[rarity]).toBeDefined();
    }
  });
});
