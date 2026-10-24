import { achievementRaritySchema } from '@marquinhos/contracts/http/routes/gamification';
import { describe, expect, it } from 'bun:test';
import { WORDLE_ACHIEVEMENT_CATALOG } from './catalog';
import {
  WORDLE_ACHIEVEMENT_FAMILIES,
  wordleAchievementRuleSchema,
} from './rules';

const PHASE_ONE_IDS = [
  'wordle_first_win',
  'wordle_wins_10',
  'wordle_wins_50',
  'wordle_streak_3',
  'wordle_streak_7',
  'wordle_streak_30',
  'wordle_solved_in_1',
  'wordle_solved_in_2',
  'wordle_played_10',
];

describe('WORDLE_ACHIEVEMENT_CATALOG', () => {
  it('has unique ids prefixed with wordle_', () => {
    const ids = WORDLE_ACHIEVEMENT_CATALOG.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id.startsWith('wordle_'))).toBe(true);
  });

  it('keeps every phase-one id so existing unlocks stay valid', () => {
    const ids = new Set(WORDLE_ACHIEVEMENT_CATALOG.map((d) => d.id));
    for (const id of PHASE_ONE_IDS) expect(ids.has(id)).toBe(true);
  });

  it('stores only rules the schema accepts', () => {
    for (const definition of WORDLE_ACHIEVEMENT_CATALOG) {
      expect(wordleAchievementRuleSchema.parse(definition.rule)).toEqual(
        definition.rule,
      );
    }
  });

  it('uses known families and rarities with positive rewards and text', () => {
    for (const d of WORDLE_ACHIEVEMENT_CATALOG) {
      expect(WORDLE_ACHIEVEMENT_FAMILIES).toContain(d.family);
      expect(achievementRaritySchema.parse(d.rarity)).toBe(d.rarity);
      expect(d.rewardXp).toBeGreaterThan(0);
      expect(d.name.length).toBeGreaterThan(0);
      expect(d.description.length).toBeGreaterThan(0);
      expect(d.icon.length).toBeGreaterThan(0);
    }
  });

  it('numbers tiers 1..n without gaps inside every family', () => {
    for (const family of WORDLE_ACHIEVEMENT_FAMILIES) {
      const tiers = WORDLE_ACHIEVEMENT_CATALOG.filter(
        (d) => d.family === family,
      )
        .map((d) => d.tier)
        .sort((a, b) => a - b);
      expect(tiers.length).toBeGreaterThan(0);
      expect(tiers).toEqual(tiers.map((_, i) => i + 1));
    }
  });

  it('never rewards a harder counter tier with less XP', () => {
    for (const family of ['wins', 'streak', 'played'] as const) {
      const rewards = WORDLE_ACHIEVEMENT_CATALOG.filter(
        (d) => d.family === family,
      )
        .sort((a, b) => a.tier - b.tier)
        .map((d) => d.rewardXp);
      expect(rewards).toEqual([...rewards].sort((a, b) => a - b));
    }
  });

  it('keeps a mix of visible and secret achievements', () => {
    const hidden = WORDLE_ACHIEVEMENT_CATALOG.filter((d) => d.hidden);
    expect(hidden.length).toBeGreaterThan(0);
    expect(hidden.length).toBeLessThan(WORDLE_ACHIEVEMENT_CATALOG.length / 2);
  });
});
