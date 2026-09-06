import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { describe, expect, it, mock } from 'bun:test';
import React, { type ReactNode } from 'react';
import {
  RoomConnectionContext,
  type RoomState,
} from '../../games/shared/RoomConnectionProvider';
import { RoomHeader } from './RoomHeader';

mock.module('../../lib/discordParticipants', () => ({
  getParticipantDisplayNames: async () => ({}),
}));

function wrapWith(value: React.ContextType<typeof RoomConnectionContext>) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <RoomConnectionContext.Provider value={value}>
        {children}
      </RoomConnectionContext.Provider>
    );
  };
}

function baseRoomState(overrides: Partial<RoomState> = {}): RoomState {
  return {
    game: 'tic-tac-toe',
    hostUserId: 'me',
    queueEnabled: false,
    matchInProgress: false,
    members: [{ userId: 'me', role: 'player' }],
    ...overrides,
  };
}

function baseValue(
  overrides: Partial<
    NonNullable<React.ContextType<typeof RoomConnectionContext>>
  >,
) {
  return {
    send: mock(() => {}),
    connectionState: 'connected' as const,
    role: 'player' as const,
    currentUserId: 'me',
    subscribe: () => () => {},
    isHost: false,
    roomState: baseRoomState(),
    ...overrides,
  };
}

async function renderHeader(
  onLeave: () => void,
  value: React.ContextType<typeof RoomConnectionContext>,
) {
  await act(async () => {
    render(<RoomHeader onLeave={onLeave} />, { wrapper: wrapWith(value) });
  });
}

describe('RoomHeader', () => {
  it('shows the switch-game control only to the host', async () => {
    await renderHeader(
      () => {},
      baseValue({
        isHost: true,
        roomState: baseRoomState({ hostUserId: 'me' }),
      }),
    );
    expect(screen.getByText(/trocar de jogo/i)).toBeTruthy();
  });

  it('hides the switch-game control from a non-host', async () => {
    await renderHeader(
      () => {},
      baseValue({
        isHost: false,
        roomState: baseRoomState({ hostUserId: 'someone-else' }),
      }),
    );
    expect(screen.queryByText(/trocar de jogo/i)).toBeNull();
  });

  it('shows the queue toggle only for a queue-eligible game, host-only', async () => {
    await renderHeader(
      () => {},
      baseValue({
        isHost: true,
        roomState: baseRoomState({ game: 'tic-tac-toe' }),
      }),
    );
    expect(screen.getByText(/ativar fila de espera/i)).toBeTruthy();
  });

  it('hides the queue toggle for a non-queue-eligible game', async () => {
    await renderHeader(
      () => {},
      baseValue({ isHost: true, roomState: baseRoomState({ game: 'wordle' }) }),
    );
    expect(screen.queryByText(/ativar fila de espera/i)).toBeNull();
  });

  it('sends toggle_queue when the host flips the queue toggle', async () => {
    const send = mock(() => {});
    await renderHeader(
      () => {},
      baseValue({
        send,
        isHost: true,
        roomState: baseRoomState({ game: 'tic-tac-toe', queueEnabled: false }),
      }),
    );

    fireEvent.click(screen.getByRole('checkbox'));

    expect(send).toHaveBeenCalledWith({
      type: 'toggle_queue',
      payload: { enabled: true },
    });
  });

  it('shows "give up seat" only for a seated player when the queue is non-empty and no match is in progress', async () => {
    await renderHeader(
      () => {},
      baseValue({
        role: 'player',
        roomState: baseRoomState({
          members: [
            { userId: 'me', role: 'player' },
            { userId: 'other', role: 'queued' },
          ],
        }),
      }),
    );

    expect(screen.getByText(/ceder vaga/i)).toBeTruthy();
  });

  it('hides "give up seat" when the queue is empty', async () => {
    await renderHeader(
      () => {},
      baseValue({
        role: 'player',
        roomState: baseRoomState({
          members: [{ userId: 'me', role: 'player' }],
        }),
      }),
    );

    expect(screen.queryByText(/ceder vaga/i)).toBeNull();
  });

  it('calls onLeave when "leave room" is pressed', async () => {
    const onLeave = mock(() => {});
    await renderHeader(onLeave, baseValue({}));

    fireEvent.click(screen.getByText(/sair da sala/i));

    expect(onLeave).toHaveBeenCalled();
  });

  it('shows a rejection banner when an action_rejected message arrives, then clears it', async () => {
    let deliver:
      ((message: { type: string; payload?: unknown }) => void) | null = null;
    await renderHeader(
      () => {},
      baseValue({
        subscribe: (onMessage) => {
          deliver = onMessage;
          return () => {};
        },
      }),
    );

    await act(async () => {
      deliver?.({
        type: 'action_rejected',
        payload: { error: 'Only the host can switch games' },
      });
    });

    await waitFor(() =>
      expect(screen.getByText(/only the host can switch games/i)).toBeTruthy(),
    );
  });
});
