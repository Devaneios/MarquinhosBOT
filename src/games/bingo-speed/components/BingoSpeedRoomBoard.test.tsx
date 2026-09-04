import { describe, expect, it, mock } from 'bun:test';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { RoomConnectionContext } from '../../shared/RoomConnectionProvider';

mock.module('./BingoSpeedBoardCanvas', () => ({
  BingoSpeedBoardCanvas: () => null,
  CANVAS_SIZE: 500,
}));

function baseValue(overrides: Partial<NonNullable<React.ContextType<typeof RoomConnectionContext>>>) {
  return {
    send: mock(() => {}),
    connectionState: 'connected' as const,
    role: 'player' as const,
    currentUserId: 'me',
    subscribe: () => () => {},
    isHost: false,
    roomState: {
      game: 'bingo-speed' as const,
      hostUserId: 'me',
      queueEnabled: false,
      matchInProgress: true,
      members: [{ userId: 'me', role: 'player' as const }],
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
  const { BingoSpeedRoomBoard } = await import(
    `./BingoSpeedRoomBoard.tsx?${Math.random()}`
  );
  await act(async () => {
    render(
      <RoomConnectionContext.Provider value={finalValue}>
        <BingoSpeedRoomBoard />
      </RoomConnectionContext.Provider>,
    );
  });
  await act(async () => {
    deliver?.({
      type: 'init',
      payload: { card: { board: [[1]], marked: [[false]] }, state: { drawnNumbers: [] } },
    });
  });
}

describe('BingoSpeedRoomBoard claim gating', () => {
  it('disables Claim Bingo for a spectator even once a card has loaded', async () => {
    await renderRoomBoard(baseValue({ role: 'spectator' }));

    const button = screen.getByRole('button', { name: /bingo/i });
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it('disables Claim Bingo for a queued viewer', async () => {
    await renderRoomBoard(baseValue({ role: 'queued' }));

    const button = screen.getByRole('button', { name: /bingo/i });
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it('enables Claim Bingo for a seated player once the card has loaded, and sends claim_bingo', async () => {
    const send = mock(() => {});
    await renderRoomBoard(baseValue({ send, role: 'player' }));

    const button = screen.getByRole('button', { name: /bingo/i });
    expect((button as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(button);

    expect(send).toHaveBeenCalledWith({ type: 'claim_bingo' });
  });
});
