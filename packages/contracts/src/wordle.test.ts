import { describe, expect, it } from 'bun:test';
import { serverMessageSchema } from './activity/games/wordle';
import { wordleGuessResultSchema } from './http/routes/wordle';
import { wordlePlayerStatsSchema } from './wordle';

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
};

const guess = {
  guess: 'termo',
  feedback: ['correct', 'correct', 'correct', 'correct', 'correct'],
  guesses: [],
  solved: true,
  attempts: 1,
  wordLength: 5,
};

describe('Wordle achievement messages', () => {
  it('preserves progress updates for badges that are still locked', () => {
    const achievementProgress = [
      { id: 'wordle_wins_10', progress: { current: 1, target: 10 } },
    ];
    expect(
      wordleGuessResultSchema.parse({ ...guess, achievementProgress }),
    ).toHaveProperty('achievementProgress', achievementProgress);
  });
  it('preserves locked and unlocked badges in session initialization', () => {
    const message = serverMessageSchema.parse({
      type: 'init',
      payload: {
        wordLength: 5,
        guesses: [],
        solved: false,
        attempts: 0,
        achievements: [
          { ...badge, progress: { current: 1, target: 1 }, holdersPercent: 50 },
          {
            ...badge,
            id: 'locked',
            unlockedAt: null,
            progress: null,
            holdersPercent: null,
          },
        ],
      },
    });
    expect(message.payload).toHaveProperty('achievements', [
      { ...badge, progress: { current: 1, target: 1 }, holdersPercent: 50 },
      {
        ...badge,
        id: 'locked',
        unlockedAt: null,
        progress: null,
        holdersPercent: null,
      },
    ]);
  });

  it('validates player stats and preserves them in init and guess results', () => {
    const stats = {
      played: 10,
      wins: 7,
      winRate: 70,
      currentStreak: 2,
      bestStreak: 5,
      distribution: [1, 2, 2, 1, 0, 0, 1],
    };
    expect(wordlePlayerStatsSchema.parse(stats)).toEqual(stats);
    expect(wordleGuessResultSchema.parse({ ...guess, stats })).toHaveProperty(
      'stats',
      stats,
    );
    expect(
      serverMessageSchema.parse({
        type: 'init',
        payload: {
          wordLength: 5,
          guesses: [],
          solved: false,
          attempts: 0,
          stats,
        },
      }).payload,
    ).toHaveProperty('stats', stats);
    expect(
      wordlePlayerStatsSchema.safeParse({ ...stats, distribution: [1, 2] })
        .success,
    ).toBe(false);
    expect(
      wordlePlayerStatsSchema.safeParse({ ...stats, winRate: 101 }).success,
    ).toBe(false);
    expect(
      wordlePlayerStatsSchema.safeParse({ ...stats, wins: -1 }).success,
    ).toBe(false);
  });

  it('preserves fresh unlocks in HTTP and realtime guess results', () => {
    const result = { ...guess, unlockedAchievements: [badge] };
    expect(wordleGuessResultSchema.parse(result)).toHaveProperty(
      'unlockedAchievements',
      [badge],
    );
    expect(
      serverMessageSchema.parse({ type: 'guess_result', payload: result })
        .payload,
    ).toHaveProperty('unlockedAchievements', [badge]);
  });

  it('rejects a fresh unlock without a valid timestamp', () => {
    for (const unlockedAt of [null, 'not-a-date']) {
      expect(
        wordleGuessResultSchema.safeParse({
          ...guess,
          unlockedAchievements: [{ ...badge, unlockedAt }],
        }).success,
      ).toBe(false);
    }
  });

  it('continues to accept messages from before achievements were added', () => {
    expect(wordleGuessResultSchema.safeParse(guess).success).toBe(true);
    expect(
      serverMessageSchema.safeParse({
        type: 'init',
        payload: { wordLength: 5, guesses: [], solved: false, attempts: 0 },
      }).success,
    ).toBe(true);
  });
});
