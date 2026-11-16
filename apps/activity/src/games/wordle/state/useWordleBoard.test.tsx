import type { ActivityMessage } from '@/platform/realtime/colyseus/connection';
import { clientMessageSchema } from '@marquinhos/contracts/activity/games/wordle';
import type {
  WordleAchievementStatus,
  WordleUnlockedAchievement,
} from '@marquinhos/contracts/wordle';
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, jest, mock } from 'bun:test';
import { revealDurationMs } from '../constants';

const originalMatchMedia = window.matchMedia;
afterEach(() => window.sessionStorage.clear());

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
let sentMessages: ActivityMessage[] = [];

mock.module('@/platform/realtime/colyseus/useColyseusRoom', () => ({
  useColyseusRoom(
    _game: string,
    _session: unknown,
    _endpoint: string,
    onMessage: (message: ActivityMessage) => void,
  ) {
    deliverMessage = onMessage;
    return {
      send: (message: ActivityMessage) => {
        sentMessages.push(message);
      },
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
      payload: {
        wordLength: 5,
        date: '2026-10-29',
        guesses: [],
        solved: false,
        attempts: 0,
      },
    });
  });
  return rendered;
}

describe('useWordleBoard focus controls', () => {
  it('restores a newer remote draft after reconnecting to the same board', async () => {
    sentMessages = [];
    const { result, unmount } = await renderBoardHook();
    act(() =>
      deliverMessage({
        type: 'init',
        payload: {
          wordLength: 5,
          date: '2026-10-29',
          guesses: [],
          solved: false,
          attempts: 0,
          syncOnly: true,
          draft: {
            date: '2026-10-29',
            rowIndex: 0,
            cells: ['t', 'e', '', '', ''],
            activeIndex: 2,
            revision: 2,
          },
        },
      }),
    );
    expect(result.current.currentLetters).toEqual(['t', 'e', '', '', '']);
    expect(result.current.activeIndex).toBe(2);
    expect(sentMessages).toHaveLength(0);
    act(() => result.current.typeLetter('r'));
    expect(sentMessages[0]).toMatchObject({
      type: 'draft_update',
      payload: { expectedRevision: 2 },
    });
    unmount();
  });

  it('keeps an unsaved local edit when a reconnect snapshot arrives', async () => {
    const { result, unmount } = await renderBoardHook();
    act(() => result.current.typeLetter('a'));
    act(() =>
      deliverMessage({
        type: 'init',
        payload: {
          wordLength: 5,
          date: '2026-10-29',
          guesses: [],
          solved: false,
          attempts: 0,
          syncOnly: true,
          draft: {
            date: '2026-10-29',
            rowIndex: 0,
            cells: ['t', 'e', '', '', ''],
            activeIndex: 2,
            revision: 2,
          },
        },
      }),
    );
    expect(result.current.currentLetters).toEqual(['a', '', '', '', '']);
    unmount();
  });

  it('shows newly earned achievements when a newer synchronized board arrives', async () => {
    const { result, unmount } = await renderBoardHook();
    const stats = {
      played: 0,
      wins: 0,
      winRate: 0,
      currentStreak: 0,
      bestStreak: 0,
      distribution: [0, 0, 0, 0, 0, 0, 0, 0],
    };
    const locked = {
      id: 'new',
      name: 'Nova',
      description: 'Nova',
      icon: '🏆',
      rarity: 'common',
      rewardXp: 25,
      unlockedAt: null,
    };
    act(() =>
      deliverMessage({
        type: 'init',
        payload: {
          date: '2026-10-29',
          wordLength: 5,
          guesses: [],
          solved: false,
          attempts: 0,
          achievementOverview: { stats, achievements: [locked] },
        },
      }),
    );
    act(() =>
      deliverMessage({
        type: 'init',
        payload: {
          date: '2026-10-29',
          wordLength: 5,
          guesses: [hit('termo')],
          solved: true,
          attempts: 1,
          syncOnly: true,
          achievementOverview: {
            stats: { ...stats, played: 1, wins: 1, winRate: 100 },
            achievements: [
              { ...locked, unlockedAt: '2026-10-29T12:00:00.000Z' },
            ],
          },
        },
      }),
    );
    expect(result.current.solved).toBe(true);
    expect(
      result.current.unlockedAchievements.map(
        (item: WordleUnlockedAchievement) => item.id,
      ),
    ).toEqual(['new']);
    unmount();
  });
  it('ignores an older synchronization snapshot after a guess', async () => {
    const { result, unmount } = await renderBoardHook();
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
        },
      }),
    );
    act(() =>
      deliverMessage({
        type: 'init',
        payload: {
          date: '2026-10-29',
          wordLength: 5,
          guesses: [],
          solved: false,
          attempts: 0,
          syncOnly: true,
        },
      }),
    );
    expect(result.current.guesses).toEqual([miss('carro')]);
    unmount();
  });
  it('restores draft gaps and position, then serializes edits by acknowledged revision', async () => {
    sentMessages = [];
    const { result } = await renderBoardHook();
    act(() =>
      deliverMessage({
        type: 'init',
        payload: {
          wordLength: 5,
          date: '2026-10-29',
          guesses: [],
          solved: false,
          attempts: 0,
          draft: {
            date: '2026-10-29',
            rowIndex: 0,
            cells: ['p', '', 'r', '', 's'],
            activeIndex: 3,
            revision: 7,
          },
        },
      }),
    );
    expect(result.current.currentLetters).toEqual(['p', '', 'r', '', 's']);
    expect(result.current.activeIndex).toBe(3);
    expect(sentMessages).toHaveLength(0);

    act(() => result.current.typeLetter('a'));
    expect(sentMessages).toHaveLength(1);
    expect(sentMessages[0]).toEqual({
      type: 'draft_update',
      payload: {
        date: '2026-10-29',
        rowIndex: 0,
        cells: ['p', '', 'r', 'a', 's'],
        activeIndex: 4,
        expectedRevision: 7,
        requestId: 1,
      },
    });

    act(() => result.current.typeLetter('e'));

    await act(async () => {
      deliverMessage({
        type: 'draft_result',
        payload: {
          requestId: 1,
          status: 'saved',
          draft: {
            date: '2026-10-29',
            rowIndex: 0,
            cells: ['p', '', 'r', 'a', 's'],
            activeIndex: 4,
            revision: 8,
          },
        },
      });
      await Promise.resolve();
    });
    expect(sentMessages).toHaveLength(2);
    expect(sentMessages[1]).toMatchObject({
      type: 'draft_update',
      payload: {
        cells: ['p', '', 'r', 'a', 'e'],
        expectedRevision: 8,
        requestId: 2,
      },
    });
  });

  it('turns delivered paste input into a positional draft update', async () => {
    sentMessages = [];
    const { result } = await renderBoardHook();
    const event = {
      preventDefault: () => {},
      clipboardData: { getData: () => 'termo' },
    } as unknown as React.ClipboardEvent<HTMLInputElement>;
    act(() => result.current.onPasteCell(0, event));
    expect(sentMessages[0]).toMatchObject({
      type: 'draft_update',
      payload: {
        cells: ['t', 'e', 'r', 'm', 'o'],
        activeIndex: 4,
        expectedRevision: 0,
        requestId: 1,
      },
    });
  });

  it('replaces the full achievement overview and queues named unlocks in server order', async () => {
    const { result } = await renderBoardHook();
    const first = {
      id: 'wordle_v2_wins_1',
      name: 'Primeira palavra',
      description: 'Acerte a primeira palavra.',
      icon: '🏆',
      rarity: 'common',
      rewardXp: 25,
      family: 'wins',
      tier: 1,
      hidden: false,
      unlockedAt: null,
      progress: { current: 0, target: 1 },
      holdersPercent: 40,
    };
    const hidden = {
      ...first,
      id: 'wordle_v2_secret',
      name: '',
      description: '',
      icon: '❔',
      hidden: true,
      unlockedAt: null,
      progress: null,
    };
    const stats = {
      played: 0,
      wins: 0,
      winRate: 0,
      currentStreak: 0,
      bestStreak: 0,
      distribution: [0, 0, 0, 0, 0, 0, 0, 0],
    };
    const initialOverview = { achievements: [first, hidden], stats };

    act(() =>
      deliverMessage({
        type: 'init',
        payload: {
          wordLength: 5,
          date: '2026-10-29',
          guesses: [],
          solved: false,
          attempts: 0,
          achievementOverview: initialOverview,
        },
      }),
    );
    expect(
      result.current.achievements.map(
        (item: WordleAchievementStatus) => item.id,
      ),
    ).toEqual([first.id, hidden.id]);
    expect(result.current.stats).toEqual(stats);

    act(() =>
      deliverMessage({
        type: 'init',
        payload: {
          wordLength: 5,
          date: '2026-10-29',
          guesses: [],
          solved: false,
          attempts: 0,
        },
      }),
    );
    expect(
      result.current.achievements.map(
        (item: WordleAchievementStatus) => item.id,
      ),
    ).toEqual([first.id, hidden.id]);
    expect(result.current.stats).toEqual(stats);

    const unlockedAt = '2026-10-24T04:15:00.000Z';
    const unlockedOverview = {
      stats: { ...stats, played: 1, wins: 1, winRate: 100, currentStreak: 1 },
      achievements: [
        { ...first, unlockedAt, progress: { current: 1, target: 1 } },
        {
          ...hidden,
          name: 'Segredo revelado',
          description: 'Acerte em uma situação rara.',
          icon: '🌙',
          unlockedAt,
        },
      ],
    };
    act(() =>
      deliverMessage({
        type: 'guess_result',
        payload: {
          guess: 'termo',
          feedback: hit('termo').feedback,
          guesses: [hit('termo')],
          solved: true,
          attempts: 1,
          wordLength: 5,
          achievementUpdate: {
            overview: unlockedOverview,
            unlockedIds: [hidden.id, first.id],
          },
        },
      }),
    );

    expect(result.current.achievements).toEqual(unlockedOverview.achievements);
    expect(result.current.stats).toEqual(unlockedOverview.stats);
    expect(result.current.achievements[1]?.name).toBe('Segredo revelado');
    expect(
      result.current.unlockedAchievements.map(
        (item: WordleUnlockedAchievement) => item.id,
      ),
    ).toEqual([hidden.id, first.id]);

    const retained = result.current.achievements;
    const retainedStats = result.current.stats;
    act(() =>
      deliverMessage({
        type: 'guess_result',
        payload: {
          guess: 'livro',
          feedback: miss('livro').feedback,
          guesses: [hit('termo'), miss('livro')],
          solved: false,
          attempts: 2,
          wordLength: 5,
        },
      }),
    );
    expect(result.current.guesses).toHaveLength(2);
    expect(result.current.achievements).toEqual(retained);
    expect(result.current.stats).toEqual(retainedStats);
    expect(
      result.current.unlockedAchievements.map(
        (item: WordleUnlockedAchievement) => item.id,
      ),
    ).toEqual([hidden.id, first.id]);
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
      payload: {
        wordLength: 5,
        date: '2026-10-29',
        guesses,
        solved,
        attempts: guesses.length,
      },
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

  it('retries the latest draft after an acknowledgement is lost', async () => {
    jest.useFakeTimers();
    sentMessages = [];
    const { result } = await renderBoardHook();

    act(() => result.current.typeLetter('t'));
    expect(sentMessages).toHaveLength(1);

    await act(async () => {
      jest.advanceTimersByTime(5_000);
      await Promise.resolve();
    });

    expect(sentMessages).toHaveLength(2);
    expect(sentMessages[1]).toMatchObject({
      type: 'draft_update',
      payload: {
        cells: ['t', '', '', '', ''],
        expectedRevision: 0,
        requestId: 2,
      },
    });

    await act(async () => {
      deliverMessage({
        type: 'draft_result',
        payload: {
          requestId: 1,
          status: 'saved',
          draft: {
            date: '2026-10-29',
            rowIndex: 0,
            cells: ['t', '', '', '', ''],
            activeIndex: 1,
            revision: 1,
          },
        },
      });
      await Promise.resolve();
    });
    act(() => result.current.typeLetter('e'));
    expect(sentMessages).toHaveLength(2);

    await act(async () => {
      deliverMessage({
        type: 'draft_result',
        payload: {
          requestId: 2,
          status: 'conflict',
          draft: {
            date: '2026-10-29',
            rowIndex: 0,
            cells: ['t', '', '', '', ''],
            activeIndex: 1,
            revision: 1,
          },
        },
      });
      await Promise.resolve();
    });
    expect(sentMessages).toHaveLength(3);
    expect(sentMessages[2]).toMatchObject({
      type: 'draft_update',
      payload: {
        cells: ['t', 'e', '', '', ''],
        expectedRevision: 1,
        requestId: 3,
      },
    });
  });

  it('hydrates achievements on init, replaces them from an award overview, and dismisses notices', async () => {
    const { useWordleBoard } = await import(
      `./useWordleBoard.ts?${Math.random()}`
    );
    const { result } = renderHook(() =>
      useWordleBoard(
        { token: 'token-1', roomKey: 'wordle-user-1' },
        { enabled: true, enableSpaceKey: false, enableArrowKeys: false },
      ),
    );
    const stats = {
      played: 0,
      wins: 0,
      winRate: 0,
      currentStreak: 0,
      bestStreak: 0,
      distribution: [0, 0, 0, 0, 0, 0, 0, 0],
    };
    const locked = {
      id: 'wordle_wins_10',
      name: 'Dez palavras',
      description: 'Acerte 10 palavras.',
      icon: '🏅',
      rarity: 'rare',
      rewardXp: 100,
      unlockedAt: null,
    };

    act(() => {
      deliverMessage({
        type: 'init',
        payload: {
          wordLength: 5,
          date: '2026-10-29',
          guesses: [],
          solved: false,
          attempts: 0,
          achievementOverview: {
            stats,
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
              locked,
            ],
          },
        },
      });
    });

    expect(result.current.achievements).toHaveLength(2);
    expect(result.current.achievements[0]?.unlockedAt).toBeNull();
    expect(result.current.unlockedAchievements).toEqual([]);

    const unlockedAt = '2026-10-24T04:15:00.000Z';
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
          achievementUpdate: {
            overview: {
              stats: {
                ...stats,
                played: 1,
                wins: 1,
                winRate: 100,
                currentStreak: 1,
                bestStreak: 1,
                distribution: [1, 0, 0, 0, 0, 0, 0, 0],
              },
              achievements: [
                {
                  id: 'wordle_first_win',
                  name: 'Primeira palavra',
                  description: 'Acerte sua primeira palavra.',
                  icon: '🟩',
                  rarity: 'common',
                  rewardXp: 25,
                  unlockedAt,
                },
                locked,
              ],
            },
            unlockedIds: ['wordle_first_win'],
          },
        },
      });
    });

    expect(
      result.current.unlockedAchievements.map(
        (item: WordleUnlockedAchievement) => item.id,
      ),
    ).toEqual(['wordle_first_win']);
    expect(result.current.hasUnlockedInSession).toBe(true);
    expect(result.current.achievements[0]?.unlockedAt).toBe(unlockedAt);
    expect(result.current.achievements[1]?.unlockedAt).toBeNull();

    act(() => result.current.dismissUnlockedAchievements());
    expect(result.current.unlockedAchievements).toEqual([]);
    expect(result.current.hasUnlockedInSession).toBe(true);
  });

  it('replaces stats and collection, queues multiple unlocks, and shifts one toast at a time', async () => {
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
          date: '2026-10-29',
          guesses: [],
          solved: false,
          attempts: 0,
          achievementOverview: {
            stats: {
              played: 9,
              wins: 8,
              winRate: 89,
              currentStreak: 2,
              bestStreak: 5,
              distribution: [1, 2, 3, 1, 1, 0, 0, 0],
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
          achievementUpdate: {
            overview: {
              stats: {
                played: 10,
                wins: 9,
                winRate: 90,
                currentStreak: 3,
                bestStreak: 5,
                distribution: [2, 2, 3, 1, 1, 0, 0, 0],
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
                  unlockedAt: '2026-10-24T04:20:00.000Z',
                  progress: { current: 3, target: 3 },
                  holdersPercent: 42,
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
                  progress: { current: 9, target: 10 },
                  holdersPercent: 30,
                },
              ],
            },
            unlockedIds: ['wordle_streak_3', 'wordle_night_owl'],
          },
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

describe('achievement recovery', () => {
  afterEach(() => jest.useRealTimers());

  it('restores an unanswered guess after the board remounts', async () => {
    jest.useFakeTimers();
    const firstBoard = await renderBoardHook();
    const initialStats = {
      played: 0,
      wins: 0,
      winRate: 0,
      currentStreak: 0,
      bestStreak: 0,
      distribution: [0, 0, 0, 0, 0, 0, 0, 0],
    };
    act(() =>
      deliverMessage({
        type: 'init',
        payload: {
          wordLength: 5,
          date: '2026-10-29',
          guesses: [],
          solved: false,
          attempts: 0,
          achievementOverview: { stats: initialStats, achievements: [] },
        },
      }),
    );
    sentMessages = [];
    for (const letter of 'termo')
      act(() => firstBoard.result.current.typeLetter(letter));
    act(() => firstBoard.result.current.submitGuess());
    const first = sentMessages.find((message) => message.type === 'guess');
    if (!first) throw new Error('Expected a guess');
    const parsed = clientMessageSchema.parse(first);
    if (parsed.type !== 'guess' || !parsed.payload.requestId)
      throw new Error('Expected a request id');
    expect(parsed.payload.captureAchievementBaseline).toBe(true);
    firstBoard.unmount();
    sentMessages = [];
    const secondBoard = await renderBoardHook();
    act(() => jest.advanceTimersByTime(5_000));
    expect(sentMessages.filter((message) => message.type === 'guess')).toEqual([
      first,
    ]);
    const stats = {
      played: 1,
      wins: 1,
      winRate: 100,
      currentStreak: 1,
      bestStreak: 1,
      distribution: [1, 0, 0, 0, 0, 0, 0, 0],
    };
    const fresh = {
      id: 'new',
      name: 'Nova',
      description: 'Nova',
      icon: '🏆',
      rarity: 'common',
      rewardXp: 25,
      unlockedAt: '2026-10-29T12:00:00.000Z',
    };
    act(() =>
      deliverMessage({
        type: 'guess_result',
        payload: {
          requestId: parsed.payload.requestId,
          guess: 'termo',
          feedback: hit('termo').feedback,
          guesses: [hit('termo')],
          solved: true,
          attempts: 1,
          wordLength: 5,
          achievementBaseline: [],
          achievementUpdate: {
            overview: { stats, achievements: [fresh] },
            unlockedIds: [],
          },
        },
      }),
    );
    expect(
      secondBoard.result.current.unlockedAchievements.map(
        (item: WordleUnlockedAchievement) => item.id,
      ),
    ).toEqual(['new']);
    secondBoard.unmount();
    sentMessages = [];
    const thirdBoard = await renderBoardHook();
    act(() => jest.advanceTimersByTime(5_000));
    expect(
      sentMessages.filter((message) => message.type === 'guess'),
    ).toHaveLength(0);
    thirdBoard.unmount();
  });

  it('does not retry another room’s pending guess after the session changes', async () => {
    jest.useFakeTimers();
    const { useWordleBoard } = await import(
      `./useWordleBoard.ts?${Math.random()}`
    );
    const { result, rerender, unmount } = renderHook(
      ({ roomKey }) =>
        useWordleBoard(
          { token: 'token', roomKey },
          { enabled: true, enableSpaceKey: true, enableArrowKeys: false },
        ),
      { initialProps: { roomKey: 'room-a' } },
    );
    act(() =>
      deliverMessage({
        type: 'init',
        payload: {
          wordLength: 5,
          date: '2026-10-29',
          guesses: [],
          solved: false,
          attempts: 0,
        },
      }),
    );
    for (const letter of 'termo') act(() => result.current.typeLetter(letter));
    act(() => result.current.submitGuess());
    sentMessages = [];
    rerender({ roomKey: 'room-b' });
    act(() => jest.advanceTimersByTime(5_000));
    expect(
      sentMessages.filter((message) => message.type === 'guess'),
    ).toHaveLength(0);
    unmount();
  });

  it('retries a lost guess response with the same id and stops after receiving it', async () => {
    jest.useFakeTimers();
    const { result, unmount } = await renderBoardHook();
    sentMessages = [];
    for (const letter of 'termo') act(() => result.current.typeLetter(letter));
    act(() => result.current.submitGuess());
    const first = sentMessages.find((message) => message.type === 'guess');
    if (!first) throw new Error('Expected a guess');
    const parsed = clientMessageSchema.parse(first);
    if (parsed.type !== 'guess' || !parsed.payload.requestId)
      throw new Error('Expected a guess request id');
    expect(parsed.payload.guess).toBe('termo');
    act(() => jest.advanceTimersByTime(5_000));
    expect(sentMessages.filter((message) => message.type === 'guess')).toEqual([
      first,
      first,
    ]);
    const requestId = parsed.payload.requestId;
    act(() =>
      deliverMessage({
        type: 'guess_result',
        payload: {
          requestId,
          guess: 'termo',
          feedback: hit('termo').feedback,
          guesses: [hit('termo')],
          solved: true,
          attempts: 1,
          wordLength: 5,
          achievementBaseline: [],
        },
      }),
    );
    expect(result.current.solved).toBe(true);
    act(() => jest.advanceTimersByTime(10_000));
    expect(
      sentMessages.filter((message) => message.type === 'guess'),
    ).toHaveLength(2);
    unmount();
  });

  it('uses the saved baseline if an overview arrives before a very late guess reply', async () => {
    jest.useFakeTimers();
    const { result, unmount } = await renderBoardHook();
    sentMessages = [];
    for (const letter of 'termo') act(() => result.current.typeLetter(letter));
    act(() => result.current.submitGuess());
    const request = clientMessageSchema.parse(
      sentMessages.find((message) => message.type === 'guess'),
    );
    if (request.type !== 'guess' || !request.payload.requestId)
      throw new Error('Expected request id');
    act(() => jest.advanceTimersByTime(30_000));
    const stats = {
      played: 1,
      wins: 1,
      winRate: 100,
      currentStreak: 1,
      bestStreak: 1,
      distribution: [1, 0, 0, 0, 0, 0, 0, 0],
    };
    const fresh = {
      id: 'new',
      name: 'Nova',
      description: 'Nova',
      icon: '🏆',
      rarity: 'common',
      rewardXp: 25,
      unlockedAt: '2026-10-29T12:00:00.000Z',
    };
    const overview = { stats, achievements: [fresh] };
    act(() =>
      deliverMessage({
        type: 'achievement_refresh_result',
        payload: { requestId: 1, pending: false, overview },
      }),
    );
    expect(result.current.unlockedAchievements).toEqual([]);
    act(() =>
      deliverMessage({
        type: 'guess_result',
        payload: {
          requestId: request.payload.requestId,
          guess: 'termo',
          feedback: hit('termo').feedback,
          guesses: [hit('termo')],
          solved: true,
          attempts: 1,
          wordLength: 5,
          achievementBaseline: [],
          achievementUpdate: { overview, unlockedIds: [] },
        },
      }),
    );
    expect(
      result.current.unlockedAchievements.map(
        (item: WordleUnlockedAchievement) => item.id,
      ),
    ).toEqual(['new']);
    unmount();
  });

  it('does not redisplay a dismissed award when the guess reply arrives late', async () => {
    jest.useFakeTimers();
    const { result, unmount } = await renderBoardHook();
    const stats = {
      played: 0,
      wins: 0,
      winRate: 0,
      currentStreak: 0,
      bestStreak: 0,
      distribution: [0, 0, 0, 0, 0, 0, 0, 0],
    };
    const locked = {
      id: 'new',
      name: 'Nova',
      description: 'Nova',
      icon: '🏆',
      rarity: 'common',
      rewardXp: 25,
      unlockedAt: null,
    };
    act(() =>
      deliverMessage({
        type: 'init',
        payload: {
          wordLength: 5,
          date: '2026-10-29',
          guesses: [],
          solved: false,
          attempts: 0,
          achievementOverview: { stats, achievements: [locked] },
          achievementPending: true,
        },
      }),
    );
    sentMessages = [];
    for (const letter of 'termo') act(() => result.current.typeLetter(letter));
    act(() => result.current.submitGuess());
    const request = clientMessageSchema.parse(
      sentMessages.find((message) => message.type === 'guess'),
    );
    if (request.type !== 'guess' || !request.payload.requestId)
      throw new Error('Expected request id');
    act(() => jest.advanceTimersByTime(30_000));
    const overview = {
      stats: { ...stats, played: 1, wins: 1, winRate: 100 },
      achievements: [{ ...locked, unlockedAt: '2026-10-29T12:00:00.000Z' }],
    };
    act(() =>
      deliverMessage({
        type: 'achievement_refresh_result',
        payload: { requestId: 1, pending: false, overview },
      }),
    );
    expect(result.current.unlockedAchievements).toHaveLength(1);
    act(() => result.current.dismissCurrentAchievement());
    act(() =>
      deliverMessage({
        type: 'guess_result',
        payload: {
          requestId: request.payload.requestId,
          guess: 'termo',
          feedback: hit('termo').feedback,
          guesses: [hit('termo')],
          solved: true,
          attempts: 1,
          wordLength: 5,
          achievementBaseline: [],
          achievementUpdate: { overview, unlockedIds: [] },
        },
      }),
    );
    expect(result.current.unlockedAchievements).toEqual([]);
    unmount();
  });

  it('retains achievement state through a reconnect until the lost guess reply is replayed', async () => {
    jest.useFakeTimers();
    const { result, unmount } = await renderBoardHook();
    const stats = {
      played: 0,
      wins: 0,
      winRate: 0,
      currentStreak: 0,
      bestStreak: 0,
      distribution: [0, 0, 0, 0, 0, 0, 0, 0],
    };
    const locked = {
      id: 'new',
      name: 'Nova',
      description: 'Nova',
      icon: '🏆',
      rarity: 'common',
      rewardXp: 25,
      unlockedAt: null,
    };
    act(() =>
      deliverMessage({
        type: 'init',
        payload: {
          wordLength: 5,
          date: '2026-10-29',
          guesses: [],
          solved: false,
          attempts: 0,
          achievementOverview: { stats, achievements: [locked] },
        },
      }),
    );
    sentMessages = [];
    for (const letter of 'termo') act(() => result.current.typeLetter(letter));
    act(() => result.current.submitGuess());
    const request = clientMessageSchema.parse(
      sentMessages.find((message) => message.type === 'guess'),
    );
    if (request.type !== 'guess' || !request.payload.requestId)
      throw new Error('Expected request id');
    const won = {
      stats: { ...stats, played: 1, wins: 1, winRate: 100 },
      achievements: [{ ...locked, unlockedAt: '2026-10-29T12:00:00.000Z' }],
    };
    act(() =>
      deliverMessage({
        type: 'init',
        payload: {
          wordLength: 5,
          date: '2026-10-29',
          guesses: [hit('termo')],
          solved: true,
          attempts: 1,
          achievementOverview: won,
        },
      }),
    );
    expect(result.current.achievements[0]?.unlockedAt).toBeNull();
    act(() => jest.advanceTimersByTime(5_000));
    expect(
      sentMessages.filter((message) => message.type === 'guess'),
    ).toHaveLength(2);
    act(() =>
      deliverMessage({
        type: 'guess_result',
        payload: {
          requestId: request.payload.requestId,
          guess: 'termo',
          feedback: hit('termo').feedback,
          guesses: [hit('termo')],
          solved: true,
          attempts: 1,
          wordLength: 5,
          achievementUpdate: { overview: won, unlockedIds: [] },
        },
      }),
    );
    expect(
      result.current.unlockedAchievements.map(
        (item: WordleUnlockedAchievement) => item.id,
      ),
    ).toEqual(['new']);
    unmount();
  });
  it('refreshes a deferred overview when the pending guess is rejected after a reconnect', async () => {
    jest.useFakeTimers();
    const { result, unmount } = await renderBoardHook();
    const stats = {
      played: 0,
      wins: 0,
      winRate: 0,
      currentStreak: 0,
      bestStreak: 0,
      distribution: [0, 0, 0, 0, 0, 0, 0, 0],
    };
    act(() =>
      deliverMessage({
        type: 'init',
        payload: {
          wordLength: 5,
          date: '2026-10-29',
          guesses: [],
          solved: false,
          attempts: 0,
          achievementOverview: { stats, achievements: [] },
        },
      }),
    );
    sentMessages = [];
    for (const letter of 'termo') act(() => result.current.typeLetter(letter));
    act(() => result.current.submitGuess());
    const request = clientMessageSchema.parse(
      sentMessages.find((message) => message.type === 'guess'),
    );
    if (request.type !== 'guess' || !request.payload.requestId)
      throw new Error('Expected request id');
    act(() =>
      deliverMessage({
        type: 'init',
        payload: {
          wordLength: 5,
          date: '2026-10-30',
          guesses: [],
          solved: false,
          attempts: 0,
          achievementOverview: { stats, achievements: [] },
        },
      }),
    );
    act(() =>
      deliverMessage({
        type: 'guess_error',
        payload: {
          message: 'O dia do jogo mudou.',
          requestId: request.payload.requestId,
        },
      }),
    );
    sentMessages = [];
    act(() => jest.advanceTimersByTime(10_000));
    expect(
      sentMessages.filter((message) => message.type === 'achievement_refresh'),
    ).toHaveLength(1);
    unmount();
  });

  it('announces only new awards when the initial collection was unavailable', async () => {
    jest.useFakeTimers();
    const { result, unmount } = await renderBoardHook();
    sentMessages = [];
    for (const letter of 'termo') act(() => result.current.typeLetter(letter));
    act(() => result.current.submitGuess());
    const guess = clientMessageSchema.parse(
      sentMessages.find((message) => message.type === 'guess'),
    );
    if (guess.type !== 'guess') throw new Error('Expected a guess');
    expect(guess.payload.guess).toBe('termo');
    expect(guess.payload.date).toBe('2026-10-29');
    expect(guess.payload.captureAchievementBaseline).toBe(true);
    act(() =>
      deliverMessage({
        type: 'guess_result',
        payload: {
          guess: 'termo',
          feedback: hit('termo').feedback,
          guesses: [hit('termo')],
          solved: true,
          attempts: 1,
          wordLength: 5,
          achievementBaseline: ['old'],
        },
      }),
    );
    act(() => jest.advanceTimersByTime(10_000));
    const stats = {
      played: 1,
      wins: 1,
      winRate: 100,
      currentStreak: 1,
      bestStreak: 1,
      distribution: [1, 0, 0, 0, 0, 0, 0, 0],
    };
    const old = {
      id: 'old',
      name: 'Antiga',
      description: 'Antiga',
      icon: '🏆',
      rarity: 'common',
      rewardXp: 25,
      unlockedAt: '2026-10-01T12:00:00.000Z',
    };
    const fresh = {
      ...old,
      id: 'new',
      name: 'Nova',
      unlockedAt: '2026-10-29T12:00:00.000Z',
    };
    act(() =>
      deliverMessage({
        type: 'achievement_refresh_result',
        payload: {
          requestId: 1,
          overview: { stats, achievements: [old, fresh] },
          pending: false,
        },
      }),
    );
    expect(
      result.current.unlockedAchievements.map(
        (item: WordleUnlockedAchievement) => item.id,
      ),
    ).toEqual(['new']);
    unmount();
  });

  it('does not let an earlier refresh hide a new award while a guess is in flight', async () => {
    jest.useFakeTimers();
    const { result, unmount } = await renderBoardHook();
    act(() => jest.advanceTimersByTime(10_000));
    for (const letter of 'termo') act(() => result.current.typeLetter(letter));
    act(() => result.current.submitGuess());
    const stats = {
      played: 1,
      wins: 1,
      winRate: 100,
      currentStreak: 1,
      bestStreak: 1,
      distribution: [1, 0, 0, 0, 0, 0, 0, 0],
    };
    const fresh = {
      id: 'new',
      name: 'Nova',
      description: 'Nova',
      icon: '🏆',
      rarity: 'common',
      rewardXp: 25,
      unlockedAt: '2026-10-29T12:00:00.000Z',
    };
    act(() =>
      deliverMessage({
        type: 'achievement_refresh_result',
        payload: {
          requestId: 1,
          pending: false,
          overview: { stats, achievements: [fresh] },
        },
      }),
    );
    expect(result.current.achievements).toEqual([]);
    act(() =>
      deliverMessage({
        type: 'guess_result',
        payload: {
          guess: 'termo',
          feedback: hit('termo').feedback,
          guesses: [hit('termo')],
          solved: true,
          attempts: 1,
          wordLength: 5,
          achievementBaseline: [],
          achievementUpdate: {
            overview: { stats, achievements: [fresh] },
            unlockedIds: [],
          },
        },
      }),
    );
    expect(
      result.current.unlockedAchievements.map(
        (item: WordleUnlockedAchievement) => item.id,
      ),
    ).toEqual(['new']);
    unmount();
  });

  it('does not start another refresh while waiting for a guess result', async () => {
    jest.useFakeTimers();
    const { result, unmount } = await renderBoardHook();
    sentMessages = [];
    for (const letter of 'termo') act(() => result.current.typeLetter(letter));
    act(() => result.current.submitGuess());
    act(() => jest.advanceTimersByTime(10_000));
    expect(
      sentMessages.filter((message) => message.type === 'achievement_refresh'),
    ).toHaveLength(0);
    act(() =>
      deliverMessage({
        type: 'guess_result',
        payload: {
          guess: 'termo',
          feedback: hit('termo').feedback,
          guesses: [hit('termo')],
          solved: true,
          attempts: 1,
          wordLength: 5,
          achievementBaseline: [],
        },
      }),
    );
    act(() => jest.advanceTimersByTime(10_000));
    expect(
      sentMessages.filter((message) => message.type === 'achievement_refresh'),
    ).toHaveLength(1);
    unmount();
  });

  it('retains the baseline when reconnecting before a failed award refresh', async () => {
    const { result, unmount } = await renderBoardHook();
    act(() =>
      deliverMessage({
        type: 'guess_result',
        payload: {
          guess: 'termo',
          feedback: hit('termo').feedback,
          guesses: [hit('termo')],
          solved: true,
          attempts: 1,
          wordLength: 5,
          achievementBaseline: ['old'],
        },
      }),
    );
    const stats = {
      played: 1,
      wins: 1,
      winRate: 100,
      currentStreak: 1,
      bestStreak: 1,
      distribution: [1, 0, 0, 0, 0, 0, 0, 0],
    };
    const old = {
      id: 'old',
      name: 'Antiga',
      description: 'Antiga',
      icon: '🏆',
      rarity: 'common',
      rewardXp: 25,
      unlockedAt: '2026-10-01T12:00:00.000Z',
    };
    const fresh = {
      ...old,
      id: 'new',
      name: 'Nova',
      unlockedAt: '2026-10-29T12:00:00.000Z',
    };
    act(() =>
      deliverMessage({
        type: 'init',
        payload: {
          wordLength: 5,
          date: '2026-10-29',
          guesses: [hit('termo')],
          solved: true,
          attempts: 1,
          achievementOverview: { stats, achievements: [old, fresh] },
        },
      }),
    );
    expect(
      result.current.unlockedAchievements.map(
        (item: WordleUnlockedAchievement) => item.id,
      ),
    ).toEqual(['new']);
    unmount();
  });

  it('announces a concurrent worker award using the captured baseline', async () => {
    const { result, unmount } = await renderBoardHook();
    const stats = {
      played: 1,
      wins: 1,
      winRate: 100,
      currentStreak: 1,
      bestStreak: 1,
      distribution: [1, 0, 0, 0, 0, 0, 0, 0],
    };
    const old = {
      id: 'old',
      name: 'Antiga',
      description: 'Antiga',
      icon: '🏆',
      rarity: 'common',
      rewardXp: 25,
      unlockedAt: '2026-10-01T12:00:00.000Z',
    };
    const fresh = {
      ...old,
      id: 'new',
      name: 'Nova',
      unlockedAt: '2026-10-29T12:00:00.000Z',
    };
    act(() =>
      deliverMessage({
        type: 'guess_result',
        payload: {
          guess: 'termo',
          feedback: hit('termo').feedback,
          guesses: [hit('termo')],
          solved: true,
          attempts: 1,
          wordLength: 5,
          achievementBaseline: ['old'],
          achievementUpdate: {
            overview: { stats, achievements: [old, fresh] },
            unlockedIds: [],
          },
        },
      }),
    );
    expect(
      result.current.unlockedAchievements.map(
        (item: WordleUnlockedAchievement) => item.id,
      ),
    ).toEqual(['new']);
    unmount();
  });

  it('announces a concurrent worker award when an initial overview exists', async () => {
    const { result, unmount } = await renderBoardHook();
    const stats = {
      played: 0,
      wins: 0,
      winRate: 0,
      currentStreak: 0,
      bestStreak: 0,
      distribution: [0, 0, 0, 0, 0, 0, 0, 0],
    };
    const first = {
      id: 'new',
      name: 'Nova',
      description: 'Nova',
      icon: '🏆',
      rarity: 'common',
      rewardXp: 25,
      unlockedAt: null,
    };
    act(() =>
      deliverMessage({
        type: 'init',
        payload: {
          wordLength: 5,
          date: '2026-10-29',
          guesses: [],
          solved: false,
          attempts: 0,
          achievementOverview: { stats, achievements: [first] },
        },
      }),
    );
    act(() =>
      deliverMessage({
        type: 'guess_result',
        payload: {
          guess: 'termo',
          feedback: hit('termo').feedback,
          guesses: [hit('termo')],
          solved: true,
          attempts: 1,
          wordLength: 5,
          achievementUpdate: {
            overview: {
              stats: { ...stats, played: 1, wins: 1, winRate: 100 },
              achievements: [
                { ...first, unlockedAt: '2026-10-29T12:00:00.000Z' },
              ],
            },
            unlockedIds: [],
          },
        },
      }),
    );
    expect(
      result.current.unlockedAchievements.map(
        (item: WordleUnlockedAchievement) => item.id,
      ),
    ).toEqual(['new']);
    unmount();
  });

  it('refreshes achievements after reconnecting to an unchanged board', async () => {
    jest.useFakeTimers();
    const { result, unmount } = await renderBoardHook();
    const stats = {
      played: 0,
      wins: 0,
      winRate: 0,
      currentStreak: 0,
      bestStreak: 0,
      distribution: [0, 0, 0, 0, 0, 0, 0, 0],
    };
    const achievement = {
      id: 'offline',
      name: 'Conquista',
      description: 'Conquista',
      icon: '🏆',
      rarity: 'common',
      rewardXp: 25,
      unlockedAt: null,
    };
    const locked = { stats, achievements: [achievement] };
    act(() =>
      deliverMessage({
        type: 'init',
        payload: {
          date: '2026-10-29',
          wordLength: 5,
          guesses: [],
          attempts: 0,
          solved: false,
          achievementOverview: locked,
          achievementPending: true,
        },
      }),
    );
    sentMessages = [];
    act(() => jest.advanceTimersByTime(10_000));
    expect(sentMessages).toContainEqual({
      type: 'achievement_refresh',
      payload: { requestId: 1 },
    });
    act(() =>
      deliverMessage({
        type: 'init',
        payload: {
          date: '2026-10-29',
          wordLength: 5,
          guesses: [],
          attempts: 0,
          solved: false,
          syncOnly: true,
          achievementOverview: locked,
          achievementPending: false,
        },
      }),
    );
    const staleUnlock = '2026-10-01T12:00:00.000Z';
    act(() =>
      deliverMessage({
        type: 'achievement_refresh_result',
        payload: {
          requestId: 1,
          pending: false,
          overview: {
            stats,
            achievements: [{ ...achievement, unlockedAt: staleUnlock }],
          },
        },
      }),
    );
    expect(result.current.achievements[0]?.unlockedAt).toBeNull();
    act(() => jest.advanceTimersByTime(10_000));
    expect(sentMessages).toContainEqual({
      type: 'achievement_refresh',
      payload: { requestId: 2 },
    });
    const unlockedAt = '2026-10-29T12:00:00.000Z';
    act(() =>
      deliverMessage({
        type: 'achievement_refresh_result',
        payload: {
          requestId: 2,
          pending: false,
          overview: { stats, achievements: [{ ...achievement, unlockedAt }] },
        },
      }),
    );
    expect(result.current.achievements[0]?.unlockedAt).toBe(unlockedAt);
    expect(
      result.current.unlockedAchievements.map(
        (item: WordleUnlockedAchievement) => item.id,
      ),
    ).toEqual(['offline']);
    unmount();
  });

  it('retries an overview that loaded while awards were still pending', async () => {
    jest.useFakeTimers();
    const { unmount } = await renderBoardHook();
    const stats = {
      played: 0,
      wins: 0,
      winRate: 0,
      currentStreak: 0,
      bestStreak: 0,
      distribution: [0, 0, 0, 0, 0, 0, 0, 0],
    };
    act(() =>
      deliverMessage({
        type: 'init',
        payload: {
          wordLength: 5,
          date: '2026-10-29',
          guesses: [],
          solved: false,
          attempts: 0,
          achievementOverview: { stats, achievements: [] },
          achievementPending: true,
        },
      }),
    );
    sentMessages = [];
    act(() => jest.advanceTimersByTime(10_000));
    expect(sentMessages).toContainEqual({
      type: 'achievement_refresh',
      payload: { requestId: 1 },
    });
    unmount();
  });

  it('restores a missing initial overview without announcing historical unlocks', async () => {
    jest.useFakeTimers();
    const { result, unmount } = await renderBoardHook();
    sentMessages = [];
    act(() => jest.advanceTimersByTime(10_000));
    expect(sentMessages).toContainEqual({
      type: 'achievement_refresh',
      payload: { requestId: 1 },
    });
    const old = {
      id: 'historical',
      name: 'Antiga',
      description: 'Já conquistada',
      icon: '🏆',
      rarity: 'common',
      rewardXp: 25,
      unlockedAt: '2026-10-01T12:00:00.000Z',
    };
    const stats = {
      played: 1,
      wins: 1,
      winRate: 100,
      currentStreak: 1,
      bestStreak: 1,
      distribution: [1, 0, 0, 0, 0, 0, 0, 0],
    };
    act(() =>
      deliverMessage({
        type: 'achievement_refresh_result',
        payload: {
          requestId: 1,
          overview: { stats, achievements: [old] },
          pending: false,
        },
      }),
    );
    expect(result.current.achievements[0]?.id).toBe('historical');
    expect(result.current.unlockedAchievements).toEqual([]);
    unmount();
  });

  it('accepts a slow refresh response even after a retry was sent', async () => {
    jest.useFakeTimers();
    const { result, unmount } = await renderBoardHook();
    sentMessages = [];
    act(() => jest.advanceTimersByTime(20_000));
    expect(
      sentMessages.filter((message) => message.type === 'achievement_refresh'),
    ).toHaveLength(2);
    const stats = {
      played: 1,
      wins: 1,
      winRate: 100,
      currentStreak: 1,
      bestStreak: 1,
      distribution: [1, 0, 0, 0, 0, 0, 0, 0],
    };
    act(() =>
      deliverMessage({
        type: 'achievement_refresh_result',
        payload: {
          requestId: 1,
          overview: { stats, achievements: [] },
          pending: false,
        },
      }),
    );
    expect(result.current.stats).toEqual(stats);
    act(() => jest.advanceTimersByTime(20_000));
    expect(
      sentMessages.filter((message) => message.type === 'achievement_refresh'),
    ).toHaveLength(2);
    unmount();
  });

  it('does not replace a newer guess result with an older refresh', async () => {
    jest.useFakeTimers();
    const { result, unmount } = await renderBoardHook();
    const stats = {
      played: 0,
      wins: 0,
      winRate: 0,
      currentStreak: 0,
      bestStreak: 0,
      distribution: [0, 0, 0, 0, 0, 0, 0, 0],
    };
    const achievement = {
      id: 'first',
      name: 'Primeira palavra',
      description: 'Acerte',
      icon: '🟩',
      rarity: 'common',
      rewardXp: 25,
      unlockedAt: null,
    };
    const oldOverview = { stats, achievements: [achievement] };
    act(() =>
      deliverMessage({
        type: 'init',
        payload: {
          wordLength: 5,
          date: '2026-10-29',
          guesses: [],
          solved: false,
          attempts: 0,
          achievementOverview: oldOverview,
          achievementPending: true,
        },
      }),
    );
    sentMessages = [];
    act(() => jest.advanceTimersByTime(10_000));
    const unlockedAt = '2026-10-29T12:00:00.000Z';
    const newOverview = {
      stats: { ...stats, played: 1, wins: 1, winRate: 100 },
      achievements: [{ ...achievement, unlockedAt }],
    };
    act(() =>
      deliverMessage({
        type: 'guess_result',
        payload: {
          guess: 'termo',
          feedback: hit('termo').feedback,
          guesses: [hit('termo')],
          solved: true,
          attempts: 1,
          wordLength: 5,
          achievementUpdate: { overview: newOverview, unlockedIds: ['first'] },
        },
      }),
    );
    act(() =>
      deliverMessage({
        type: 'achievement_refresh_result',
        payload: { requestId: 1, overview: oldOverview, pending: false },
      }),
    );
    expect(result.current.achievements[0]?.unlockedAt).toBe(unlockedAt);
    expect(
      result.current.unlockedAchievements.map(
        (item: WordleUnlockedAchievement) => item.id,
      ),
    ).toEqual(['first']);
    unmount();
  });

  it('refreshes a failed award until recovered and announces it only once', async () => {
    jest.useFakeTimers();
    const { result, unmount } = await renderBoardHook();
    const stats = {
      played: 0,
      wins: 0,
      winRate: 0,
      currentStreak: 0,
      bestStreak: 0,
      distribution: [0, 0, 0, 0, 0, 0, 0, 0],
    };
    const locked = {
      id: 'wordle_first_win',
      name: 'Primeira palavra',
      description: 'Acerte sua primeira palavra.',
      icon: '🟩',
      rarity: 'common',
      rewardXp: 25,
      unlockedAt: null,
    };
    const initial = { stats, achievements: [locked] };
    act(() =>
      deliverMessage({
        type: 'init',
        payload: {
          wordLength: 5,
          date: '2026-10-29',
          guesses: [],
          solved: false,
          attempts: 0,
          achievementOverview: initial,
        },
      }),
    );
    sentMessages = [];
    act(() =>
      deliverMessage({
        type: 'guess_result',
        payload: {
          guess: 'termo',
          feedback: hit('termo').feedback,
          guesses: [hit('termo')],
          solved: true,
          attempts: 1,
          wordLength: 5,
        },
      }),
    );
    act(() => jest.advanceTimersByTime(10_000));
    expect(sentMessages).toContainEqual({
      type: 'achievement_refresh',
      payload: { requestId: 1 },
    });
    act(() =>
      deliverMessage({
        type: 'achievement_refresh_result',
        payload: { requestId: 1, overview: initial, pending: true },
      }),
    );
    expect(result.current.unlockedAchievements).toEqual([]);
    act(() => jest.advanceTimersByTime(10_000));
    const unlockedAt = '2026-10-29T12:00:00.000Z';
    const recovered = {
      stats: { ...stats, played: 1, wins: 1, winRate: 100 },
      achievements: [{ ...locked, unlockedAt }],
    };
    act(() =>
      deliverMessage({
        type: 'achievement_refresh_result',
        payload: { requestId: 2, overview: recovered, pending: false },
      }),
    );
    expect(result.current.achievements[0]?.unlockedAt).toBe(unlockedAt);
    expect(
      result.current.unlockedAchievements.map(
        (item: WordleUnlockedAchievement) => item.id,
      ),
    ).toEqual([locked.id]);
    act(() =>
      deliverMessage({
        type: 'achievement_refresh_result',
        payload: { requestId: 1, overview: initial, pending: true },
      }),
    );
    expect(result.current.achievements[0]?.unlockedAt).toBe(unlockedAt);
    act(() => jest.advanceTimersByTime(20_000));
    expect(
      sentMessages.filter((message) => message.type === 'achievement_refresh'),
    ).toHaveLength(2);
    unmount();
  });
});
