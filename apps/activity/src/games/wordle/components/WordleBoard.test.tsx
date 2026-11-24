import '@/i18n';
import type { ActivityMessage } from '@/platform/realtime/colyseus/connection';
import type { WordleUserConfig } from '@marquinhos/contracts/wordle';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, jest, mock } from 'bun:test';
import { MemoryRouter } from 'react-router-dom';

let deliverMessage: (message: ActivityMessage) => void = () => {
  throw new Error('Wordle room is not connected');
};
let connectionState = 'connected';

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
      connectionState,
      role: null,
    };
  },
}));

const keyboardConfig = {
  invertActionKeys: false,
  enableSounds: false,
  enableSpaceKey: true,
  enableArrowKeys: true,
} satisfies WordleUserConfig;

afterEach(() => {
  connectionState = 'connected';
  jest.useRealTimers();
});

function renderBoard(
  WordleBoard: typeof import('./WordleBoard').WordleBoard,
  identity?: { accessToken: string; guildId: string; userId: string },
) {
  return render(
    <MemoryRouter>
      <WordleBoard
        session={{ token: 'token-1', roomKey: 'wordle-user-1' }}
        config={keyboardConfig}
        onSaveConfig={async () => {}}
        {...identity}
      />
    </MemoryRouter>,
  );
}

function initializeBoard() {
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
}

function findKey(container: HTMLElement, label: string): HTMLElement {
  const key = Array.from(container.querySelectorAll('.hg-button')).find(
    (element) => element.querySelector('.keycap-text')?.textContent === label,
  );
  if (!(key instanceof HTMLElement)) {
    throw new Error(`Expected ${label} key to render`);
  }
  return key;
}

describe('WordleBoard focus keyboard', () => {
  it('moves the focused letter when space and arrow keycaps are pressed', async () => {
    const { WordleBoard } = await import(`./WordleBoard.tsx?${Math.random()}`);
    const { container } = render(
      <MemoryRouter>
        <WordleBoard
          session={{ token: 'token-1', roomKey: 'wordle-user-1' }}
          config={keyboardConfig}
          onSaveConfig={async () => {}}
        />
      </MemoryRouter>,
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

    fireEvent.pointerDown(findKey(container, 'ESPAÇO'));
    expect(document.activeElement?.getAttribute('aria-label')).toBe(
      screen
        .getByRole('textbox', { name: /letra 2/i })
        .getAttribute('aria-label'),
    );

    fireEvent.pointerDown(findKey(container, '>>'));
    expect(document.activeElement?.getAttribute('aria-label')).toBe(
      screen
        .getByRole('textbox', { name: /letra 5/i })
        .getAttribute('aria-label'),
    );
  });
});

describe('WordleBoard screen transitions', () => {
  it('keeps the achievement collection accessible with the profile editors and album hidden', async () => {
    const { WordleBoard } = await import(`./WordleBoard.tsx?${Math.random()}`);
    renderBoard(WordleBoard, {
      accessToken: 'activity-token',
      guildId: 'guild-1',
      userId: 'user-1',
    });
    initializeBoard();

    const albumVisible =
      screen.queryByRole('button', { name: 'Abrir álbum da comunidade' }) !==
      null;
    fireEvent.click(
      screen.getByRole('button', { name: 'Abrir conquistas do Terminhos' }),
    );
    expect(screen.getByRole('heading', { name: 'Conquistas' })).toBeTruthy();
    expect({
      albumVisible,
      showcaseVisible:
        screen.queryByRole('region', { name: 'Vitrine pessoal' }) !== null,
      rewardsVisible:
        screen.queryByRole('region', { name: 'Recompensas pessoais' }) !== null,
    }).toEqual({
      albumVisible: false,
      showcaseVisible: false,
      rewardsVisible: false,
    });
  });

  it('shows a new achievement even if the initial collection failed to load', async () => {
    jest.useFakeTimers();
    const { WordleBoard } = await import(`./WordleBoard.tsx?${Math.random()}`);
    const rendered = renderBoard(WordleBoard);
    initializeBoard();
    act(() =>
      deliverMessage({
        type: 'guess_result',
        payload: {
          guess: 'termo',
          feedback: ['correct', 'correct', 'correct', 'correct', 'correct'],
          guesses: [
            {
              guess: 'termo',
              feedback: ['correct', 'correct', 'correct', 'correct', 'correct'],
            },
          ],
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
      name: 'Conquista antiga',
      description: 'Antiga',
      icon: '🏆',
      rarity: 'common',
      rewardXp: 25,
      unlockedAt: '2026-10-01T12:00:00.000Z',
    };
    const fresh = {
      ...old,
      id: 'new',
      name: 'Conquista nova',
      unlockedAt: '2026-10-29T12:00:00.000Z',
    };
    act(() =>
      deliverMessage({
        type: 'achievement_refresh_result',
        payload: {
          requestId: 1,
          pending: false,
          overview: { stats, achievements: [old, fresh] },
        },
      }),
    );
    expect(screen.getByText('Conquista nova')).toBeTruthy();
    expect(screen.queryByText('Conquista antiga')).toBeNull();
    expect(screen.getByText('+25 XP')).toBeTruthy();
    rendered.unmount();
  });
  it('shows a recovered achievement in an already open board', async () => {
    jest.useFakeTimers();
    const { WordleBoard } = await import(`./WordleBoard.tsx?${Math.random()}`);
    const rendered = renderBoard(WordleBoard);
    const stats = {
      played: 0,
      wins: 0,
      winRate: 0,
      currentStreak: 0,
      bestStreak: 0,
      distribution: [0, 0, 0, 0, 0, 0, 0, 0],
    };
    const achievement = {
      id: 'wordle_first_win',
      name: 'Primeira palavra',
      description: 'Acerte sua primeira palavra.',
      icon: '🟩',
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
          achievementOverview: { stats, achievements: [achievement] },
        },
      }),
    );
    act(() =>
      deliverMessage({
        type: 'guess_result',
        payload: {
          guess: 'termo',
          feedback: ['correct', 'correct', 'correct', 'correct', 'correct'],
          guesses: [
            {
              guess: 'termo',
              feedback: ['correct', 'correct', 'correct', 'correct', 'correct'],
            },
          ],
          solved: true,
          attempts: 1,
          wordLength: 5,
        },
      }),
    );
    expect(screen.queryByText(/conquista desbloqueada/i)).toBeNull();
    act(() => jest.advanceTimersByTime(10_000));
    act(() =>
      deliverMessage({
        type: 'achievement_refresh_result',
        payload: {
          requestId: 1,
          pending: false,
          overview: {
            stats: { ...stats, played: 1, wins: 1, winRate: 100 },
            achievements: [
              { ...achievement, unlockedAt: '2026-10-29T12:00:00.000Z' },
            ],
          },
        },
      }),
    );
    expect(screen.getByText(/conquista desbloqueada/i)).toBeTruthy();
    expect(screen.getByText('Primeira palavra')).toBeTruthy();
    expect(screen.getByText('+25 XP')).toBeTruthy();
    rendered.unmount();
  });
  it('keeps the connecting screen until the room sends the board', async () => {
    const { WordleBoard } = await import(`./WordleBoard.tsx?${Math.random()}`);
    renderBoard(WordleBoard);
    expect(screen.getByText('INICIANDO…')).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();
    initializeBoard();
    expect(screen.getAllByRole('textbox')).toHaveLength(5);
  });

  it('shows a way back when the room fails before sending the board', async () => {
    connectionState = 'error';
    const { WordleBoard } = await import(`./WordleBoard.tsx?${Math.random()}`);
    renderBoard(WordleBoard);
    expect(screen.getByText(/conexão perdida/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /voltar/i })).toBeTruthy();
  });

  it('opens settings and returns to the board', async () => {
    const { WordleBoard } = await import(`./WordleBoard.tsx?${Math.random()}`);
    renderBoard(WordleBoard);
    initializeBoard();
    fireEvent.click(
      screen.getByRole('button', { name: /abrir configurações/i }),
    );
    expect(
      screen.getByRole('switch', { name: /inverter ações/i }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /voltar/i }));
    expect(screen.getAllByRole('textbox')).toHaveLength(5);
  });

  it('shows an unlock toast on guess_result and opens the achievements collection screen', async () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = (() => ({
      matches: true,
    })) as unknown as typeof window.matchMedia;
    try {
      const { WordleBoard } = await import(
        `./WordleBoard.tsx?${Math.random()}`
      );
      renderBoard(WordleBoard);
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
                played: 0,
                wins: 0,
                winRate: 0,
                currentStreak: 0,
                bestStreak: 0,
                distribution: [0, 0, 0, 0, 0, 0, 0, 0],
              },
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
              ],
            },
          },
        });
      });

      act(() => {
        deliverMessage({
          type: 'guess_result',
          payload: {
            guess: 'termo',
            feedback: ['correct', 'correct', 'correct', 'correct', 'correct'],
            guesses: [
              {
                guess: 'termo',
                feedback: [
                  'correct',
                  'correct',
                  'correct',
                  'correct',
                  'correct',
                ],
              },
            ],
            solved: true,
            attempts: 1,
            wordLength: 5,
            achievementUpdate: {
              overview: {
                stats: {
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
                    unlockedAt: '2026-10-24T04:15:00.000Z',
                  },
                ],
              },
              unlockedIds: ['wordle_first_win'],
            },
          },
        });
      });

      expect(screen.getByText(/conquista desbloqueada/i)).toBeTruthy();
      expect(screen.getByText('Primeira palavra')).toBeTruthy();
      expect(screen.getByText('+25 XP')).toBeTruthy();

      fireEvent.click(
        screen.getByRole('button', { name: /fechar conquista desbloqueada/i }),
      );
      expect(screen.queryByText(/conquista desbloqueada/i)).toBeNull();

      const cta = screen.getByRole('button', { name: /ver conquistas/i });
      expect(cta).toBeTruthy();
      fireEvent.click(cta);
      expect(screen.getByRole('heading', { name: /conquistas/i })).toBeTruthy();
      expect(screen.getByText('1 de 1 desbloqueadas')).toBeTruthy();
      expect(screen.getByText('Desbloqueada')).toBeTruthy();

      fireEvent.click(screen.getByRole('button', { name: /voltar/i }));
      expect(screen.queryByRole('heading', { name: /conquistas/i })).toBeNull();
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  it('queues multiple unlocked achievements one at a time', async () => {
    const { WordleBoard } = await import(`./WordleBoard.tsx?${Math.random()}`);
    renderBoard(WordleBoard);
    initializeBoard();

    act(() => {
      deliverMessage({
        type: 'guess_result',
        payload: {
          guess: 'termo',
          feedback: ['correct', 'correct', 'correct', 'correct', 'correct'],
          guesses: [
            {
              guess: 'termo',
              feedback: ['correct', 'correct', 'correct', 'correct', 'correct'],
            },
          ],
          solved: true,
          attempts: 1,
          wordLength: 5,
          achievementUpdate: {
            overview: {
              stats: {
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
                  family: 'wins',
                  name: 'Primeira palavra',
                  description: 'Acerte sua primeira palavra.',
                  icon: '🟩',
                  rarity: 'common',
                  rewardXp: 25,
                  hidden: false,
                  unlockedAt: '2026-10-24T04:15:00.000Z',
                },
                {
                  id: 'wordle_solved_in_1',
                  family: 'precision',
                  name: 'Na mosca',
                  description: 'Acerte na primeira tentativa.',
                  icon: '🍀',
                  rarity: 'epic',
                  rewardXp: 100,
                  hidden: false,
                  unlockedAt: '2026-10-24T04:15:00.000Z',
                },
              ],
            },
            unlockedIds: ['wordle_first_win', 'wordle_solved_in_1'],
          },
        },
      });
    });

    expect(screen.getByText('Primeira palavra')).toBeTruthy();
    expect(screen.queryByText('Na mosca')).toBeNull();
    expect(screen.getByText('+1 na fila')).toBeTruthy();

    fireEvent.click(
      screen.getByRole('button', { name: /fechar conquista desbloqueada/i }),
    );
    expect(screen.queryByText('Primeira palavra')).toBeNull();
    expect(screen.getByText('Na mosca')).toBeTruthy();

    fireEvent.click(
      screen.getByRole('button', { name: /fechar conquista desbloqueada/i }),
    );
    expect(screen.queryByText('Na mosca')).toBeNull();
  });
});
