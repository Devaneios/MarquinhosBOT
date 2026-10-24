import type { ActivityMessage } from '@/platform/realtime/colyseus/connection';
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
    expect(result.current.achievements[0]?.unlockedAt).toBe(
      '2026-10-24T04:15:00.000Z',
    );
    expect(result.current.achievements[1]?.unlockedAt).toBeNull();

    act(() => {
      result.current.dismissUnlockedAchievements();
    });
    expect(result.current.unlockedAchievements).toEqual([]);
  });
});
