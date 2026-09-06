import { describe, expect, it, mock } from 'bun:test';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { RoomConnectionContext } from '../../shared/RoomConnectionProvider';
import { WordChainRoomBoard } from './WordChainRoomBoard';

function baseValue(overrides: Partial<NonNullable<React.ContextType<typeof RoomConnectionContext>>>) {
  return {
    send: mock(() => {}),
    connectionState: 'connected' as const,
    role: 'player' as const,
    currentUserId: 'user-c',
    subscribe: () => () => {},
    isHost: false,
    roomState: {
      game: 'word-chain' as const,
      hostUserId: 'user-a',
      queueEnabled: false,
      matchInProgress: true,
      members: [
        { userId: 'user-a', role: 'player' as const },
        { userId: 'user-b', role: 'player' as const },
        { userId: 'user-c', role: 'spectator' as const },
      ],
    },
    ...overrides,
  };
}

async function renderRoomBoard(value: NonNullable<React.ContextType<typeof RoomConnectionContext>>) {
  let deliver: ((message: { type: string; payload?: unknown }) => void) | null = null;
  const finalValue = {
    ...value,
    subscribe: (onMessage: (message: { type: string; payload?: unknown }) => void) => {
      deliver = onMessage;
      return () => {};
    },
  };
  await act(async () => {
    render(
      <RoomConnectionContext.Provider value={finalValue}>
        <WordChainRoomBoard />
      </RoomConnectionContext.Provider>,
    );
  });
  await act(async () => {
    deliver?.({
      type: 'init',
      payload: {
        currentWord: 'abelha',
        currentTurn: 'user-a',
        usedWords: ['abelha'],
        players: [
          { userId: 'user-a', alive: true },
          { userId: 'user-b', alive: true },
        ],
        gameOver: false,
        winner: null,
      },
    });
  });
}

describe('WordChainRoomBoard input gating', () => {
  it("disables the word input for a spectator, since their userId never matches currentTurn", async () => {
    await renderRoomBoard(baseValue({ currentUserId: 'user-c', role: 'spectator' }));

    const input = screen.getByPlaceholderText(/./) as HTMLInputElement;
    expect(input.disabled).toBe(true);
  });

  it("enables the word input for the seated player whose turn it is", async () => {
    await renderRoomBoard(baseValue({ currentUserId: 'user-a', role: 'player' }));

    const input = screen.getByPlaceholderText(/./) as HTMLInputElement;
    expect(input.disabled).toBe(false);
  });

  it('sends a word message when the current player submits', async () => {
    const send = mock(() => {});
    await renderRoomBoard(baseValue({ send, currentUserId: 'user-a', role: 'player' }));

    const input = screen.getByPlaceholderText(/./) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'amora' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(send).toHaveBeenCalledWith({ type: 'word', payload: { word: 'amora' } });
  });
});
