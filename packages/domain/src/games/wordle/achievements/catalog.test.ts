import { achievementRaritySchema } from '@marquinhos/contracts/http/routes/gamification';
import { wordlePatternPreviewSchema } from '@marquinhos/contracts/wordle';
import { describe, expect, it } from 'bun:test';
import {
  WORDLE_ACHIEVEMENT_CATALOG,
  WORDLE_ACHIEVEMENT_CATALOG_REVISION,
  WORDLE_ACHIEVEMENT_VERSION,
} from './catalog';
import { wordleAchievementRuleSchema } from './engine/rules';
import { WORDLE_ACHIEVEMENT_FAMILIES } from './families';
import revisions from './fixtures/catalog-revisions.json';
import { WORDLE_PATTERN_CATALOG } from './patterns';

describe('version 2 catalog', () => {
  it('keeps the curated catalog at 97 entries and drops artificial incentives', () => {
    expect(WORDLE_ACHIEVEMENT_CATALOG).toHaveLength(97);
    expect(
      WORDLE_ACHIEVEMENT_CATALOG.some((entry) =>
        [
          'solved_after',
          'expired_unsolved',
          'recovery',
          'return_after_gap',
          'slow_solve',
          'attempt_variety',
        ].includes(entry.rule.kind),
      ),
    ).toBe(false);
    expect(
      WORDLE_ACHIEVEMENT_CATALOG.find(
        (entry) => entry.id === 'wordle_v2_blank_opening',
      )?.rule,
    ).toEqual({ kind: 'blank_start' });
  });

  it('uses unique identities for the current collection', () => {
    expect(WORDLE_ACHIEVEMENT_VERSION).toBe(2);
    const ids = WORDLE_ACHIEVEMENT_CATALOG.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(
      ids.every((id) =>
        id.startsWith(`wordle_v${WORDLE_ACHIEVEMENT_VERSION}_`),
      ),
    ).toBe(true);
  });
  it('records a new revision whenever persisted content changes', () => {
    const fingerprint = new Bun.CryptoHasher('sha256')
      .update(
        JSON.stringify(
          WORDLE_ACHIEVEMENT_CATALOG.map((d) => [
            d.id,
            d.name,
            d.description,
            d.rarity,
            d.icon,
            JSON.stringify(d.rule),
            d.rewardXp,
          ]),
        ),
      )
      .digest('hex');
    const recorded: Record<string, string> = revisions;
    const latest = Math.max(0, ...Object.keys(recorded).map(Number));
    if (
      latest !== WORDLE_ACHIEVEMENT_CATALOG_REVISION ||
      recorded[latest] !== fingerprint
    )
      throw new Error(
        `Persisted catalog content changed. Set WORDLE_ACHIEVEMENT_CATALOG_REVISION to ${latest + 1} and add "${latest + 1}": "${fingerprint}" to fixtures/catalog-revisions.json.`,
      );
  });
  it('publishes every drawing with a validated preview and no hidden drawings', () => {
    const patterns = WORDLE_ACHIEVEMENT_CATALOG.filter(
      (d) => d.rule.kind === 'pattern',
    );
    expect(patterns).toHaveLength(53);
    expect(
      patterns.every(
        ({ description }) =>
          description.includes('inclusive na diagonal') &&
          description.includes('linha vencedora'),
      ),
    ).toBe(true);
    expect(
      patterns.map((d) => d.rule.kind === 'pattern' && d.rule.patternId),
    ).toEqual(WORDLE_PATTERN_CATALOG.map((p) => p.id));
    for (const definition of patterns) {
      expect(definition.hidden).toBe(false);
      expect(
        wordlePatternPreviewSchema.safeParse(definition.patternPreview).success,
      ).toBe(true);
    }
    const i = patterns.find((d) => d.id === 'wordle_v2_pattern_tetromino_i');
    expect(i?.rarity).toBe('common');
    expect(i?.rewardXp).toBe(25);
  });
  it('uses schemas, Portuguese text, known families and fixed launch rewards', () => {
    for (const d of WORDLE_ACHIEVEMENT_CATALOG) {
      expect(wordleAchievementRuleSchema.safeParse(d.rule).success).toBe(true);
      expect(WORDLE_ACHIEVEMENT_FAMILIES).toContain(d.family);
      expect(achievementRaritySchema.safeParse(d.rarity).success).toBe(true);
      expect(d.name.length).toBeGreaterThan(0);
      expect(d.description.length).toBeGreaterThan(0);
      expect(d.rewardXp).toBe(
        d.id === 'wordle_v2_letters_all' ||
          (d.rule.kind === 'wins' && d.rule.count === 365) ||
          (d.rule.kind === 'played' && d.rule.days === 365)
          ? 750
          : { common: 25, rare: 75, epic: 150, legendary: 300 }[d.rarity],
      );
    }
  });
  it('covers the seven family collections and exact milestone targets', () => {
    expect(
      WORDLE_ACHIEVEMENT_CATALOG.filter(
        (d) => d.rule.kind === 'pattern_collection',
      ).map((d) => d.rule),
    ).toEqual([
      { kind: 'pattern_collection', family: 'letter', count: 5 },
      { kind: 'pattern_collection', family: 'letter', count: 26 },
      { kind: 'pattern_collection', family: 'digit', count: 5 },
      { kind: 'pattern_collection', family: 'digit', count: 10 },
      { kind: 'pattern_collection', family: 'tetromino', count: 7 },
      { kind: 'pattern_collection', family: 'shape', count: 5 },
      { kind: 'pattern_collection', family: 'shape', count: 10 },
    ]);
    expect(
      WORDLE_ACHIEVEMENT_CATALOG.flatMap((d) =>
        d.rule.kind === 'wins' ? [d.rule.count] : [],
      ),
    ).toEqual([1, 10, 50, 100, 365]);
    expect(
      WORDLE_ACHIEVEMENT_CATALOG.flatMap((d) =>
        d.rule.kind === 'played' ? [d.rule.days] : [],
      ),
    ).toEqual([1, 7, 30, 100, 365]);
    expect(
      WORDLE_ACHIEVEMENT_CATALOG.flatMap((d) =>
        d.rule.kind === 'streak' ? [d.rule.days] : [],
      ),
    ).toEqual([3, 7, 14, 30, 100]);
  });
  it('keeps hidden conditions out of their opaque identifiers', () => {
    const hidden = WORDLE_ACHIEVEMENT_CATALOG.filter((d) => d.hidden);
    expect(hidden.length).toBeGreaterThan(0);
    expect(
      hidden.every((d) => /^wordle_v2_secret_[0-9a-f]{8}$/.test(d.id)),
    ).toBe(true);
  });
  it('never reduces XP across harder numerical tiers', () => {
    for (const kind of ['wins', 'played', 'streak', 'fast_solve'] as const) {
      const rewards = WORDLE_ACHIEVEMENT_CATALOG.filter(
        (d) => d.rule.kind === kind,
      ).map((d) => d.rewardXp);
      expect(rewards).toEqual([...rewards].sort((a, b) => a - b));
    }
  });
});
