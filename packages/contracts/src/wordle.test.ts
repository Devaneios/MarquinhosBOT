import { describe, expect, it } from 'bun:test';
import { serverMessageSchema } from './activity/games/wordle';
import { wordleGuessResultSchema } from './http/routes/wordle';

const badge = {
  id: 'wordle_first_win',
  name: 'Primeira palavra',
  description: 'Acerte a primeira palavra diária.',
  icon: '🏆',
  rarity: 'common',
  rewardXp: 25,
  unlockedAt: '2026-10-24T04:00:00.000Z',
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
  it('preserves locked and unlocked badges in session initialization', () => {
    const message = serverMessageSchema.parse({
      type: 'init',
      payload: {
        wordLength: 5,
        guesses: [],
        solved: false,
        attempts: 0,
        achievements: [badge, { ...badge, id: 'locked', unlockedAt: null }],
      },
    });
    expect(message.payload).toHaveProperty('achievements', [
      badge,
      { ...badge, id: 'locked', unlockedAt: null },
    ]);
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
