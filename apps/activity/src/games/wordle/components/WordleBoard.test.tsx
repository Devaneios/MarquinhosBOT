import '@/i18n';
import type { ActivityMessage } from '@/platform/realtime/colyseus/connection';
import type { WordleUserConfig } from '@marquinhos/contracts/wordle';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, mock } from 'bun:test';
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
});

function renderBoard(WordleBoard: typeof import('./WordleBoard').WordleBoard) {
  return render(
    <MemoryRouter>
      <WordleBoard
        session={{ token: 'token-1', roomKey: 'wordle-user-1' }}
        config={keyboardConfig}
        onSaveConfig={async () => {}}
      />
    </MemoryRouter>,
  );
}

function initializeBoard() {
  act(() => {
    deliverMessage({
      type: 'init',
      payload: { wordLength: 5, guesses: [], solved: false, attempts: 0 },
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
        payload: { wordLength: 5, guesses: [], solved: false, attempts: 0 },
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
    const { WordleBoard } = await import(`./WordleBoard.tsx?${Math.random()}`);
    renderBoard(WordleBoard);
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
          ],
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
              feedback: ['correct', 'correct', 'correct', 'correct', 'correct'],
            },
          ],
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

    expect(screen.getByText(/conquista desbloqueada/i)).toBeTruthy();
    expect(screen.getByText('Primeira palavra')).toBeTruthy();
    expect(screen.getByText('+25 XP')).toBeTruthy();

    fireEvent.click(
      screen.getByRole('button', { name: /fechar conquista desbloqueada/i }),
    );
    expect(screen.queryByText(/conquista desbloqueada/i)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /abrir conquistas/i }));
    expect(screen.getByRole('heading', { name: /conquistas/i })).toBeTruthy();
    expect(screen.getByText('1 de 1 desbloqueadas')).toBeTruthy();
    expect(screen.getByText('Desbloqueada')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /voltar/i }));
    expect(screen.queryByRole('heading', { name: /conquistas/i })).toBeNull();
  });
});
