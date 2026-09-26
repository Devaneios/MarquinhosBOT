import type { ActivityMessage } from '@/platform/realtime/colyseus/connection';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, mock } from 'bun:test';

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
