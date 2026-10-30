import { describe, expect, it } from 'bun:test';
import {
  clientMessageSchema,
  serverMessageSchema,
} from './activity/games/wordle';
import { wordleGuessResultSchema } from './http/routes/wordle';
import {
  wordleAchievementStatusSchema,
  wordleAchievementsOverviewSchema,
  wordleDraftWriteResultSchema,
  wordlePatternPreviewSchema,
  wordlePlayerStatsSchema,
} from './wordle';

const badge = {
  id: 'wordle_first_win',
  name: 'Primeira palavra',
  description: 'Acerte a primeira palavra diária.',
  icon: '🏆',
  rarity: 'common',
  rewardXp: 25,
  unlockedAt: '2026-10-24T04:00:00.000Z',
  family: 'wins',
  tier: 1,
  hidden: false,
} as const;

const guess = {
  guess: 'termo',
  feedback: ['correct', 'correct', 'correct', 'correct', 'correct'],
  guesses: [],
  solved: true,
  attempts: 1,
  wordLength: 5,
};

describe('Wordle achievement messages', () => {
  const patternPreview = {
    patternId: 'tetromino_t',
    mask: ['###', '.#.'],
    colors: ['correct', 'present'],
    rotations: [0, 90, 180, 270],
  };
  const matchEvidence = {
    patternId: 'tetromino_t',
    color: 'present',
    origin: [0, 0],
    rotation: 0,
    cells: [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 1],
    ],
    feedback: [
      ['present', 'present', 'present', 'absent', 'correct'],
      ['absent', 'present', 'absent', 'absent', 'correct'],
    ],
    date: '2026-10-26',
  };

  it('preserves drawing previews and complete evidence snapshots', () => {
    const achievement = { ...badge, patternPreview, matchEvidence };
    expect(wordleAchievementStatusSchema.parse(achievement)).toMatchObject({
      patternPreview,
      matchEvidence,
    });
  });

  it('rejects forged evidence with invalid coordinates, colors, or duplicate cells', () => {
    for (const invalid of [
      { ...matchEvidence, cells: [[9, 0]] },
      { ...matchEvidence, cells: [[0, 4]] },
      {
        ...matchEvidence,
        cells: [
          [0, 0],
          [0, 0],
        ],
      },
      { ...matchEvidence, feedback: [['present'], ['present', 'present']] },
      { ...matchEvidence, origin: [-1, 0] },
    ]) {
      expect(
        wordleAchievementStatusSchema.safeParse({
          ...badge,
          matchEvidence: invalid,
        }).success,
      ).toBe(false);
    }
  });

  it('validates player stats in an overview', () => {
    const stats = {
      played: 10,
      wins: 7,
      winRate: 70,
      currentStreak: 2,
      bestStreak: 5,
      distribution: [1, 2, 2, 1, 0, 0, 1, 0],
    };
    expect(wordlePlayerStatsSchema.parse(stats)).toEqual(stats);
    expect(
      wordleAchievementsOverviewSchema.parse({ achievements: [], stats }),
    ).toHaveProperty('stats', stats);
    expect(
      wordlePlayerStatsSchema.safeParse({ ...stats, distribution: [1, 2, 0] })
        .success,
    ).toBe(false);
    expect(
      wordlePlayerStatsSchema.safeParse({ ...stats, winRate: 101 }).success,
    ).toBe(false);
    expect(
      wordlePlayerStatsSchema.safeParse({ ...stats, wins: -1 }).success,
    ).toBe(false);
  });

  it('allows an accepted guess when the optional award update is absent', () => {
    expect(wordleGuessResultSchema.safeParse(guess).success).toBe(true);
    expect(
      serverMessageSchema.safeParse({
        type: 'init',
        payload: {
          wordLength: 5,
          date: '2026-10-29',
          guesses: [],
          solved: false,
          attempts: 0,
        },
      }).success,
    ).toBe(true);
  });

  it('uses one complete overview for initialization and each successful award', () => {
    const stats = {
      played: 2,
      wins: 2,
      winRate: 100,
      currentStreak: 2,
      bestStreak: 2,
      distribution: [0, 1, 1, 0, 0, 0, 0, 0],
    };
    const overview = {
      achievements: [
        {
          ...badge,
          unlockedAt: null,
          progress: { current: 1, target: 2 },
          holdersPercent: 50,
        },
      ],
      stats,
    };
    expect(wordleAchievementsOverviewSchema.parse(overview)).toEqual(overview);

    const update = { overview, unlockedIds: [badge.id] };
    const result = wordleGuessResultSchema.parse({
      ...guess,
      achievementUpdate: update,
      achievementVersion: 2,
      achievements: [badge],
      achievementProgress: [{ id: badge.id, progress: null }],
      unlockedAchievements: [badge],
      stats,
    });
    expect(result.achievementUpdate).toEqual(update);
    expect(result).not.toHaveProperty('achievementVersion');
    expect(result).not.toHaveProperty('achievements');
    expect(result).not.toHaveProperty('achievementProgress');
    expect(result).not.toHaveProperty('unlockedAchievements');
    expect(result).not.toHaveProperty('stats');

    const init = serverMessageSchema.parse({
      type: 'init',
      payload: {
        wordLength: 5,
        date: '2026-10-29',
        guesses: [],
        solved: false,
        attempts: 0,
        achievementOverview: overview,
        achievementVersion: 2,
        achievements: [badge],
        stats,
      },
    });
    expect(init.payload).toHaveProperty('achievementOverview', overview);
    expect(init.payload).not.toHaveProperty('achievementVersion');
    expect(init.payload).not.toHaveProperty('achievements');
    expect(init.payload).not.toHaveProperty('stats');
  });

  it('carries revisioned drafts without returning answer correctness', () => {
    const write = {
      date: '2026-10-29',
      rowIndex: 12,
      cells: ['t', '', 'r', '', 'o'],
      activeIndex: 3,
      expectedRevision: 4,
      requestId: 1,
    };
    expect(
      clientMessageSchema.parse({ type: 'draft_update', payload: write }),
    ).toEqual({ type: 'draft_update', payload: write });
    const result = wordleDraftWriteResultSchema.parse({
      status: 'saved',
      draft: {
        date: write.date,
        rowIndex: write.rowIndex,
        cells: write.cells,
        activeIndex: write.activeIndex,
        revision: 5,
      },
    });
    expect(result).not.toHaveProperty('correct');
    expect(wordleDraftWriteResultSchema.parse({ status: 'closed' })).toEqual({
      status: 'closed',
    });
  });
});

describe('wordlePatternPreviewSchema variants', () => {
  const base = {
    patternId: 'x',
    mask: ['#.#'],
    colors: ['correct'],
    rotations: [0],
  };
  it('accepts wider distinct variants up to 6 columns', () => {
    expect(
      wordlePatternPreviewSchema.safeParse({ ...base, variants: [['#...#']] })
        .success,
    ).toBe(true);
  });
  it('accepts six-column masks but rejects seven-column base or variant masks', () => {
    expect(
      wordlePatternPreviewSchema.safeParse({
        ...base,
        mask: ['######'],
        variants: [['#....#']],
      }).success,
    ).toBe(true);
    expect(
      wordlePatternPreviewSchema.safeParse({ ...base, mask: ['#######'] })
        .success,
    ).toBe(false);
    expect(
      wordlePatternPreviewSchema.safeParse({
        ...base,
        variants: [['#.....#']],
      }).success,
    ).toBe(false);
  });
  it('rejects narrower, too wide, duplicate and ragged variants', () => {
    for (const variants of [
      [['#.']],
      [['#.....#']],
      [['#.#']],
      [['#...#', '#..']],
    ])
      expect(
        wordlePatternPreviewSchema.safeParse({ ...base, variants }).success,
      ).toBe(false);
  });
});
