import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, mock } from 'bun:test';
import { MemoryRouter } from 'react-router-dom';
import '../../../i18n';
import type { ActivityMessage } from '../../shared/useColyseusRoom';
import type { WordleUserConfig } from '../types';

let deliverMessage: (message: ActivityMessage) => void = () => {
  throw new Error('Wordle room is not connected');
};

mock.module('../../shared/useColyseusRoom', () => ({
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

const keyboardConfig = {
  invertActionKeys: false,
  enableSounds: false,
  enableSpaceKey: true,
  enableArrowKeys: true,
} satisfies WordleUserConfig;

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
        payload: { wordLength: 5, guesses: [], solved: false },
      });
    });

    fireEvent.pointerDown(findKey(container, 'ESPAÇO'));
    expect(document.activeElement).toBe(
      screen.getByRole('textbox', { name: /letra 3/i }),
    );

    fireEvent.pointerDown(findKey(container, '>>'));
    expect(document.activeElement).toBe(
      screen.getByRole('textbox', { name: /letra 5/i }),
    );
  });
});
