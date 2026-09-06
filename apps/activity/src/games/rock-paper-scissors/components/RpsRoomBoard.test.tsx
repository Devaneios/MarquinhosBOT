import { describe, expect, it, mock } from 'bun:test';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { RoomConnectionContext } from '../../shared/RoomConnectionProvider';
import { RpsRoomBoard } from './RpsRoomBoard';

function baseValue(overrides: Partial<NonNullable<React.ContextType<typeof RoomConnectionContext>>>) {
  return {
    send: mock(() => {}),
    connectionState: 'connected' as const,
    role: 'player' as const,
    currentUserId: 'me',
    subscribe: () => () => {},
    isHost: false,
    roomState: {
      game: 'rock-paper-scissors' as const,
      hostUserId: 'me',
      queueEnabled: false,
      matchInProgress: true,
      members: [{ userId: 'me', role: 'player' as const }],
    },
    ...overrides,
  };
}

async function renderBoard(value: NonNullable<React.ContextType<typeof RoomConnectionContext>>) {
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
        <RpsRoomBoard />
      </RoomConnectionContext.Provider>,
    );
  });
  return {
    deliverInit: async (playerId: 'player1' | 'player2' | null) => {
      await act(async () => {
        deliver?.({ type: 'init', payload: { playerId, config: { bestOf: 3 } } });
      });
    },
    deliverRoundState: async () => {
      await act(async () => {
        deliver?.({ type: 'game_start', payload: {} });
        deliver?.({
          type: 'round_state',
          payload: { round: 1, bestOf: 3, submitted: [], scores: { player1: 0, player2: 0 } },
        });
      });
    },
  };
}

describe('RpsRoomBoard pick gating', () => {
  it('does not send a pick when the viewer is a spectator', async () => {
    const send = mock(() => {});
    const { deliverInit, deliverRoundState } = await renderBoard(baseValue({ send, role: 'spectator' }));
    await deliverInit(null);
    await deliverRoundState();

    fireEvent.click(screen.getByRole('button', { name: /pedra/i }));

    expect(send).not.toHaveBeenCalled();
  });

  it('does not send a pick when the viewer is queued', async () => {
    const send = mock(() => {});
    const { deliverInit, deliverRoundState } = await renderBoard(baseValue({ send, role: 'queued' }));
    await deliverInit(null);
    await deliverRoundState();

    fireEvent.click(screen.getByRole('button', { name: /pedra/i }));

    expect(send).not.toHaveBeenCalled();
  });

  it('sends a pick for a seated player', async () => {
    const send = mock(() => {});
    const { deliverInit, deliverRoundState } = await renderBoard(baseValue({ send, role: 'player' }));
    await deliverInit('player1');
    await deliverRoundState();

    fireEvent.click(screen.getByRole('button', { name: /pedra/i }));

    expect(send).toHaveBeenCalledWith({ type: 'pick', payload: { pick: 'rock' } });
  });
});
