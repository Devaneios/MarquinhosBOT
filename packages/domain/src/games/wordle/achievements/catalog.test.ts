import { achievementRaritySchema } from '@marquinhos/contracts/http/routes/gamification';
import { wordlePatternPreviewSchema } from '@marquinhos/contracts/wordle';
import { describe, expect, it } from 'bun:test';
import { WORDLE_ACHIEVEMENT_CATALOG, WORDLE_DRAWING_CATALOG } from './catalog';
import { WORDLE_ACHIEVEMENT_FAMILIES } from './families';

describe('Wordle achievement catalog', () => {
  it('keeps the curated catalog at 110 entries after confirmed additions', () => {
    expect(WORDLE_ACHIEVEMENT_CATALOG).toHaveLength(110);
  });

  it('publishes an evaluator on each complete achievement object', () => {
    expect(
      WORDLE_ACHIEVEMENT_CATALOG.every(
        (definition) => typeof definition.evaluate === 'function',
      ),
    ).toBe(true);
  });

  it('uses unique identities and keeps the public catalog order', () => {
    const ids = WORDLE_ACHIEVEMENT_CATALOG.map((definition) => definition.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id.startsWith('wordle_v2_'))).toBe(true);
    expect(ids[0]).toBe('wordle_v2_wins_1');
    expect(ids.at(-1)).toBe('wordle_v2_shapes_all');
  });

  it('publishes every drawing with a validated preview and no hidden drawings', () => {
    expect(WORDLE_DRAWING_CATALOG).toHaveLength(59);
    expect(
      WORDLE_ACHIEVEMENT_CATALOG.filter(({ kind }) => kind === 'drawing'),
    ).toHaveLength(59);
    for (const definition of WORDLE_ACHIEVEMENT_CATALOG) {
      if (definition.kind !== 'drawing') continue;
      expect(definition.hidden).toBe(false);
      expect(
        wordlePatternPreviewSchema.safeParse({
          patternId: definition.drawing.patternId,
          mask: definition.drawing.mask,
          variants: definition.drawing.variants,
          colors: definition.drawing.colors,
          rotations: definition.drawing.rotations,
        }).success,
      ).toBe(true);
      expect(definition.description).toContain('inclusive na diagonal');
      expect(definition.description).toContain('linha vencedora');
    }
    const tetrominoI = WORDLE_ACHIEVEMENT_CATALOG.find(
      (definition) => definition.id === 'wordle_v2_pattern_tetromino_i',
    );
    expect(tetrominoI?.kind).toBe('drawing');
    if (tetrominoI?.kind === 'drawing') {
      expect(tetrominoI.rarity).toBe('common');
      expect(tetrominoI.rewardXp).toBe(25);
      expect(tetrominoI.drawing.mask).toEqual(['####']);
    }
  });

  it('uses Portuguese text, known families and fixed launch rewards', () => {
    for (const definition of WORDLE_ACHIEVEMENT_CATALOG) {
      expect(WORDLE_ACHIEVEMENT_FAMILIES).toContain(definition.family);
      expect(achievementRaritySchema.safeParse(definition.rarity).success).toBe(
        true,
      );
      expect(definition.name.length).toBeGreaterThan(0);
      expect(definition.description.length).toBeGreaterThan(0);
      expect(definition.rewardXp).toBe(
        definition.id === 'wordle_v2_letters_all' ||
          definition.id === 'wordle_v2_wins_365' ||
          definition.id === 'wordle_v2_played_365'
          ? 750
          : { common: 25, rare: 75, epic: 150, legendary: 300 }[
              definition.rarity
            ],
      );
    }
  });

  it('publishes DEVANEIOS as a visible legendary progress achievement', () => {
    const devaneios = WORDLE_ACHIEVEMENT_CATALOG.find(
      ({ id }) => id === 'wordle_v2_devaneios_rows',
    );
    expect(devaneios).toMatchObject({
      kind: 'standard',
      family: 'vocabulary',
      name: 'DEVANEIOS',
      rarity: 'legendary',
      rewardXp: 300,
      hidden: false,
    });
    expect(devaneios?.description).toContain('mesma linha');
    expect(devaneios?.description).toContain('reinicia');
  });

  it('keeps milestone IDs and hidden conditions stable', () => {
    expect(
      WORDLE_ACHIEVEMENT_CATALOG.filter(({ id }) =>
        /^wordle_v2_wins_(1|10|50|100|365)$/.test(id),
      ).map(({ id }) => id),
    ).toEqual([
      'wordle_v2_wins_1',
      'wordle_v2_wins_10',
      'wordle_v2_wins_50',
      'wordle_v2_wins_100',
      'wordle_v2_wins_365',
    ]);
    const hidden = WORDLE_ACHIEVEMENT_CATALOG.filter(
      (definition) => definition.hidden,
    );
    expect(hidden.length).toBeGreaterThan(0);
    expect(
      hidden.every((d) => /^wordle_v2_secret_[0-9a-f]{8}$/.test(d.id)),
    ).toBe(true);
  });

  it('publishes the six confirmed new drawings with their exact masks', () => {
    const expected = new Map<string, readonly string[][]>([
      ['triangle_5', [['..#..', '.###.', '#####']]],
      ['triangle_6', [['..##..', '.####.', '######']]],
      ['staircase_right', [['..#', '.##', '###']]],
      [
        'staircase_inverted',
        [
          ['###', '##.', '#..'],
          ['###', '.##', '..#'],
        ],
      ],
      ['hang_loose', [['#...#', '#...#', '#...#', '#####', '.###.']]],
      ['middle_finger', [['..#..', '..#..', '..#..', '#####', '.###.']]],
    ]);
    for (const [patternId, masks] of expected) {
      const definition = WORDLE_ACHIEVEMENT_CATALOG.find(
        (candidate) =>
          candidate.kind === 'drawing' &&
          candidate.drawing.patternId === patternId,
      );
      expect(definition?.kind).toBe('drawing');
      if (definition?.kind !== 'drawing') continue;
      expect([
        definition.drawing.mask,
        ...(definition.drawing.variants ?? []),
      ]).toEqual([...masks]);
      expect(definition.rewardXp).toBe(75);
      expect(definition.rarity).toBe('rare');
    }
  });

  it('never reduces XP across harder numerical tiers', () => {
    const groups = [
      [
        'wordle_v2_wins_1',
        'wordle_v2_wins_10',
        'wordle_v2_wins_50',
        'wordle_v2_wins_100',
        'wordle_v2_wins_365',
      ],
      [
        'wordle_v2_played_1',
        'wordle_v2_played_7',
        'wordle_v2_played_30',
        'wordle_v2_played_100',
        'wordle_v2_played_365',
      ],
      [
        'wordle_v2_streak_3',
        'wordle_v2_streak_7',
        'wordle_v2_streak_14',
        'wordle_v2_streak_30',
        'wordle_v2_streak_100',
      ],
      ['wordle_v2_fast_60', 'wordle_v2_secret_d6a09c31'],
    ];
    for (const ids of groups) {
      const rewards = ids.map(
        (id) => WORDLE_ACHIEVEMENT_CATALOG.find((d) => d.id === id)!.rewardXp,
      );
      expect(rewards).toEqual([...rewards].sort((a, b) => a - b));
    }
  });
});
