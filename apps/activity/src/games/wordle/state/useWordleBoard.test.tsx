import type { ActivityMessage } from '@/platform/realtime/colyseus/connection';
import type { WordleAchievementStatus } from '@marquinhos/contracts/wordle';
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, jest, mock } from 'bun:test';
import { revealDurationMs } from '../constants';

const originalMatchMedia = window.matchMedia;

const miss = (guess: string) => ({
  guess,
  feedback: Array(guess.length).fill('absent'),
});

const hit = (guess: string) => ({
  guess,
  feedback: Array(guess.length).fill('correct'),
});

let deliverMessage: (message: ActivityMessage) => void = () => {
  throw new Error('Wordle room is not connected');
};

mock.module('@/platform/realtime/colyseus/useColyseusRoom', () => ({
  useColyseusRoom(
    _game: string,
    _session: unknown,
    _endpoint: string,
    onMessage: (message: ActivityMessage) => void,
  ) {
    deliverMessage = onMessage;
    return {
      send: () => {},
      connectionState: 'connected',
      role: null,
    };
  },
}));

async function renderBoardHook(enableArrowKeys = false) {
  const { useWordleBoard } = await import(
    `./useWordleBoard.ts?${Math.random()}`
  );
  const rendered = renderHook(() =>
    useWordleBoard(
      { token: 'token-1', roomKey: 'wordle-user-1' },
      {
        enabled: true,
        enableSpaceKey: true,
        enableArrowKeys,
      },
    ),
  );
  act(() => {
    deliverMessage({
      type: 'init',
      payload: { wordLength: 5, guesses: [], solved: false, attempts: 0 },
    });
  });
  return rendered;
}

describe('useWordleBoard focus controls', () => {
  it('replaces the collection and clears retired notifications on a version change', async () => {
    const { result } = await renderBoardHook();
    const retired = {
      id: 'wordle_first_win',
      name: 'Antiga',
      description: 'Antiga',
      icon: 'A',
      rarity: 'common',
      rewardXp: 25,
      family: 'wins',
      tier: 1,
      hidden: false,
      unlockedAt: '2026-10-24T04:15:00.000Z',
    };
    act(() =>
      deliverMessage({
        type: 'guess_result',
        payload: {
          guess: 'carro',
          feedback: miss('carro').feedback,
          guesses: [miss('carro')],
          solved: false,
          attempts: 1,
          wordLength: 5,
          achievementVersion: 1,
          unlockedAchievements: [retired],
        },
      }),
    );
    expect(result.current.unlockedAchievements).toHaveLength(1);
    const fresh = {
      ...retired,
      id: 'wordle_v2_wins_1',
      name: 'Nova',
      unlockedAt: null,
    };
    act(() =>
      deliverMessage({
        type: 'guess_result',
        payload: {
          guess: 'livro',
          feedback: miss('livro').feedback,
          guesses: [miss('carro'), miss('livro')],
          solved: false,
          attempts: 2,
          wordLength: 5,
          achievementVersion: 2,
          achievements: [fresh],
          unlockedAchievements: [],
        },
      }),
    );
    expect(
      result.current.achievements.map(
        (item: WordleAchievementStatus) => item.id,
      ),
    ).toEqual(['wordle_v2_wins_1']);
    expect(result.current.unlockedAchievements).toEqual([]);
    expect(result.current.hasUnlockedInSession).toBe(false);
  });

  it('discards retired collection data when a new-version delta has no snapshot', async () => {
    const { result } = await renderBoardHook();
    const retired = {
      id: 'wordle_first_win',
      name: 'Antiga',
      description: 'Antiga',
      icon: 'A',
      rarity: 'common',
      rewardXp: 25,
      unlockedAt: null,
    };
    act(() =>
      deliverMessage({
        type: 'init',
        payload: {
          wordLength: 5,
          guesses: [],
          solved: false,
          attempts: 0,
          achievementVersion: 1,
          achievements: [retired],
        },
      }),
    );
    act(() =>
      deliverMessage({
        type: 'guess_result',
        payload: {
          guess: 'carro',
          feedback: miss('carro').feedback,
          guesses: [miss('carro')],
          solved: false,
          attempts: 1,
          wordLength: 5,
          achievementVersion: 2,
        },
      }),
    );
    expect(result.current.achievements).toEqual([]);
  });

  it('moves focus one letter to the right for space', async () => {
    const { result } = await renderBoardHook();

    act(() => result.current.moveFocus('space'));

    expect(result.current.activeIndex).toBe(1);
  });

  it('moves left, right, first, and last with enabled arrow controls', async () => {
    const { result } = await renderBoardHook(true);

    act(() => result.current.moveFocus('right'));
    expect(result.current.activeIndex).toBe(1);

    act(() => result.current.moveFocus('left'));
    expect(result.current.activeIndex).toBe(0);

    act(() => result.current.moveFocus('last'));
    expect(result.current.activeIndex).toBe(4);

    act(() => result.current.moveFocus('first'));
    expect(result.current.activeIndex).toBe(0);
  });

  it('ignores arrow controls when they are disabled', async () => {
    const { result } = await renderBoardHook();

    act(() => result.current.moveFocus('right'));

    expect(result.current.activeIndex).toBe(0);
  });
});

async function renderRevealHook(
  guesses: ReturnType<typeof miss>[] = [],
  solved = false,
) {
  const { useWordleBoard } = await import(
    `./useWordleBoard.ts?${Math.random()}`
  );
  const rendered = renderHook(() =>
    useWordleBoard(
      { token: 'token-1', roomKey: 'wordle-user-1' },
      { enabled: true, enableSpaceKey: false, enableArrowKeys: false },
    ),
  );
  act(() => {
    deliverMessage({
      type: 'init',
      payload: { wordLength: 5, guesses, solved, attempts: guesses.length },
    });
  });
  return rendered;
}

function deliverGuessResult(
  guesses: ReturnType<typeof miss>[],
  solved = false,
) {
  const last = guesses[guesses.length - 1];
  act(() => {
    deliverMessage({
      type: 'guess_result',
      payload: {
        guess: last.guess,
        feedback: last.feedback,
        guesses,
        solved,
        attempts: guesses.length,
        wordLength: 5,
      },
    });
  });
}

describe('useWordleBoard reveal', () => {
  afterEach(() => {
    jest.useRealTimers();
    window.matchMedia = originalMatchMedia;
  });

  it('shows restored guesses without flipping them', async () => {
    const { result } = await renderRevealHook([miss('carro')]);
    expect(result.current.revealingRow).toBeNull();
    expect(result.current.letterStates.c).toBe('absent');
  });

  it('holds keyboard colors until the new row finishes flipping', async () => {
    jest.useFakeTimers();
    const { result } = await renderRevealHook();
    deliverGuessResult([miss('carro')]);
    expect(result.current.revealingRow).toBe(0);
    expect(result.current.letterStates.c).toBeUndefined();
    act(() => jest.advanceTimersByTime(revealDurationMs(5) - 1));
    expect(result.current.revealingRow).toBe(0);
    act(() => jest.advanceTimersByTime(1));
    expect(result.current.revealingRow).toBeNull();
    expect(result.current.letterStates.c).toBe('absent');
  });

  it('ignores typing while a row is revealing', async () => {
    jest.useFakeTimers();
    const { result } = await renderRevealHook();
    deliverGuessResult([miss('carro')]);
    act(() => result.current.typeLetter('a'));
    expect(result.current.currentLetters[0]).toBe('');
    act(() => jest.advanceTimersByTime(revealDurationMs(5)));
    act(() => result.current.typeLetter('a'));
    expect(result.current.currentLetters[0]).toBe('a');
  });

  it('celebrates a winning row after it is revealed and not when restored', async () => {
    jest.useFakeTimers();
    const { result } = await renderRevealHook();
    deliverGuessResult([hit('termo')], true);
    expect(result.current.celebrateRow).toBeNull();
    act(() => jest.advanceTimersByTime(revealDurationMs(5)));
    expect(result.current.celebrateRow).toBe(0);
    const restored = await renderRevealHook([hit('termo')], true);
    expect(restored.result.current.celebrateRow).toBeNull();
  });

  it('reveals instantly when reduced motion is requested', async () => {
    window.matchMedia = (query: string) =>
      ({
        matches: query === '(prefers-reduced-motion: reduce)',
      }) as MediaQueryList;
    const { result } = await renderRevealHook();
    deliverGuessResult([miss('carro')]);
    expect(result.current.revealingRow).toBeNull();
    expect(result.current.letterStates.c).toBe('absent');
  });

  it('hydrates achievements on init and merges newly unlocked achievements on guess_result', async () => {
    const { useWordleBoard } = await import(
      `./useWordleBoard.ts?${Math.random()}`
    );
    const { result } = renderHook(() =>
      useWordleBoard(
        { token: 'token-1', roomKey: 'wordle-user-1' },
        { enabled: true, enableSpaceKey: false, enableArrowKeys: false },
      ),
    );

    act(() => {
      deliverMessage({
        type: 'init',
        payload: {
          wordLength: 5,
          guesses: [],
          solved: false,
          attempts: 0,
          achievements: [
            {
              id: 'wordle_first_win',
              name: 'Primeira palavra',
              description: 'Acerte sua primeira palavra.',
              icon: '🟩',
              rarity: 'common',
              rewardXp: 25,
              unlockedAt: null,
            },
            {
              id: 'wordle_wins_10',
              name: 'Dez palavras',
              description: 'Acerte 10 palavras.',
              icon: '🏅',
              rarity: 'rare',
              rewardXp: 100,
              unlockedAt: null,
            },
          ],
        },
      });
    });

    expect(result.current.achievements).toHaveLength(2);
    expect(result.current.achievements[0]?.unlockedAt).toBeNull();
    expect(result.current.unlockedAchievements).toEqual([]);

    act(() => {
      deliverMessage({
        type: 'guess_result',
        payload: {
          guess: 'termo',
          feedback: Array(5).fill('correct'),
          guesses: [hit('termo')],
          solved: true,
          attempts: 1,
          wordLength: 5,
          unlockedAchievements: [
            {
              id: 'wordle_first_win',
              name: 'Primeira palavra',
              description: 'Acerte sua primeira palavra.',
              icon: '🟩',
              rarity: 'common',
              rewardXp: 25,
              unlockedAt: '2026-10-24T04:15:00.000Z',
            },
          ],
        },
      });
    });

    expect(result.current.unlockedAchievements).toHaveLength(1);
    expect(result.current.unlockedAchievements[0]?.id).toBe('wordle_first_win');
    expect(result.current.hasUnlockedInSession).toBe(true);
    expect(result.current.achievements[0]?.unlockedAt).toBe(
      '2026-10-24T04:15:00.000Z',
    );
    expect(result.current.achievements[1]?.unlockedAt).toBeNull();

    act(() => {
      result.current.dismissUnlockedAchievements();
    });
    expect(result.current.unlockedAchievements).toEqual([]);
    expect(result.current.hasUnlockedInSession).toBe(true);
  });

  it('hydrates and refreshes player stats, queues multiple unlocks, and shifts one toast at a time', async () => {
    const { useWordleBoard }: typeof import('./useWordleBoard') = await import(
      `./useWordleBoard.ts?${Math.random()}`
    );
    const { result } = renderHook(() =>
      useWordleBoard(
        { token: 'token-1', roomKey: 'wordle-user-1' },
        {
          enabled: true,
          enableSpaceKey: false,
          enableArrowKeys: false,
        },
      ),
    );

    act(() => {
      deliverMessage({
        type: 'init',
        payload: {
          wordLength: 5,
          guesses: [],
          solved: false,
          attempts: 0,
          stats: {
            played: 9,
            wins: 8,
            winRate: 89,
            currentStreak: 2,
            bestStreak: 5,
            distribution: [1, 2, 3, 1, 1, 0, 0],
          },
          achievements: [
            {
              id: 'wordle_streak_3',
              family: 'streak',
              tier: 1,
              name: 'No ritmo',
              description: '3 dias seguidos.',
              icon: '🔥',
              rarity: 'common',
              rewardXp: 50,
              hidden: false,
              unlockedAt: null,
              progress: { current: 2, target: 3 },
              holdersPercent: 42,
            },
            {
              id: 'wordle_night_owl',
              family: 'timing',
              tier: 4,
              name: '',
              description: '',
              icon: '❔',
              rarity: 'common',
              rewardXp: 50,
              hidden: true,
              unlockedAt: null,
              progress: null,
              holdersPercent: 5,
            },
            {
              id: 'wordle_wins_10',
              family: 'wins',
              tier: 2,
              name: 'Dez palavras',
              description: 'Acerte 10 palavras.',
              icon: '📚',
              rarity: 'common',
              rewardXp: 100,
              hidden: false,
              unlockedAt: null,
              progress: { current: 8, target: 10 },
              holdersPercent: 30,
            },
          ],
        },
      });
    });

    expect(result.current.stats?.played).toBe(9);
    expect(result.current.stats?.currentStreak).toBe(2);

    act(() => {
      deliverMessage({
        type: 'guess_result',
        payload: {
          guess: 'termo',
          feedback: Array(5).fill('correct'),
          guesses: [hit('termo')],
          solved: true,
          attempts: 1,
          wordLength: 5,
          stats: {
            played: 10,
            wins: 9,
            winRate: 90,
            currentStreak: 3,
            bestStreak: 5,
            distribution: [2, 2, 3, 1, 1, 0, 0],
          },
          achievementProgress: [
            { id: 'wordle_streak_3', progress: { current: 3, target: 3 } },
            { id: 'wordle_night_owl', progress: null },
            { id: 'wordle_wins_10', progress: { current: 9, target: 10 } },
          ],
          unlockedAchievements: [
            {
              id: 'wordle_streak_3',
              family: 'streak',
              tier: 1,
              name: 'No ritmo',
              description: '3 dias seguidos.',
              icon: '🔥',
              rarity: 'common',
              rewardXp: 50,
              hidden: false,
              unlockedAt: '2026-10-24T04:20:00.000Z',
            },
            {
              id: 'wordle_night_owl',
              family: 'timing',
              tier: 4,
              name: 'Coruja',
              description: 'Acerte entre meia-noite e 5h.',
              icon: '🦉',
              rarity: 'common',
              rewardXp: 50,
              hidden: true,
              unlockedAt: '2026-10-24T04:20:00.000Z',
            },
          ],
        },
      });
    });

    expect(result.current.stats?.played).toBe(10);
    expect(result.current.stats?.currentStreak).toBe(3);
    expect(result.current.unlockedAchievements.map((item) => item.id)).toEqual([
      'wordle_streak_3',
      'wordle_night_owl',
    ]);
    expect(result.current.achievements[0]?.progress).toEqual({
      current: 3,
      target: 3,
    });
    expect(result.current.achievements[0]?.holdersPercent).toBe(42);
    expect(result.current.achievements[1]?.name).toBe('Coruja');
    expect(result.current.achievements[1]?.icon).toBe('🦉');
    expect(result.current.achievements[2]?.progress).toEqual({
      current: 9,
      target: 10,
    });

    act(() => {
      result.current.dismissCurrentAchievement();
    });
    expect(result.current.unlockedAchievements.map((item) => item.id)).toEqual([
      'wordle_night_owl',
    ]);

    act(() => {
      result.current.dismissCurrentAchievement();
    });
    expect(result.current.unlockedAchievements).toEqual([]);
  });
});
