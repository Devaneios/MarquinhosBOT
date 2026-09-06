import { describe, expect, it, mock } from 'bun:test';
import { act, render } from '@testing-library/react';
import { RoomConnectionContext } from '../../shared/RoomConnectionProvider';

const capturedProps: Array<{ interactive: boolean }> = [];

mock.module('./ConnectFourCanvas', () => ({
  ConnectFourCanvas: (props: { interactive: boolean }) => {
    capturedProps.push({ interactive: props.interactive });
    return null;
  },
}));

async function renderRoomBoard(value: React.ContextType<typeof RoomConnectionContext>) {
  capturedProps.length = 0;
  const { ConnectFourRoomBoard } = await import(
    `./ConnectFourRoomBoard.tsx?${Math.random()}`
  );
  await act(async () => {
    render(
      <RoomConnectionContext.Provider value={value}>
        <ConnectFourRoomBoard />
      </RoomConnectionContext.Provider>,
    );
  });
}

function baseValue(overrides: Partial<NonNullable<React.ContextType<typeof RoomConnectionContext>>>) {
  return {
    send: mock(() => {}),
    connectionState: 'connected' as const,
    role: 'player' as const,
    currentUserId: 'me',
    subscribe: () => () => {},
    isHost: false,
    roomState: {
      game: 'connect-four' as const,
      hostUserId: 'me',
      queueEnabled: false,
      matchInProgress: false,
      members: [{ userId: 'me', role: 'player' as const }],
    },
    ...overrides,
  };
}

describe('ConnectFourRoomBoard interactivity', () => {
  it('is never interactive for a spectator, even before any state has arrived (default-state race)', async () => {
    await renderRoomBoard(baseValue({ role: 'spectator' }));

    expect(capturedProps.at(-1)?.interactive).toBe(false);
  });

  it('is never interactive for a queued viewer', async () => {
    await renderRoomBoard(baseValue({ role: 'queued' }));

    expect(capturedProps.at(-1)?.interactive).toBe(false);
  });

  it('is interactive for a seated player once it is their turn', async () => {
    let deliver: ((message: { type: string; payload?: unknown }) => void) | null = null;
    await renderRoomBoard(
      baseValue({
        role: 'player',
        subscribe: (onMessage) => {
          deliver = onMessage;
          return () => {};
        },
      }),
    );

    await act(async () => {
      deliver?.({
        type: 'init',
        payload: {
          disc: 'p1',
          state: {
            grid: Array.from({ length: 6 }, () => Array(7).fill(null)),
            currentTurn: 'p1',
            winner: null,
            winningLine: null,
            isDraw: false,
          },
        },
      });
    });

    expect(capturedProps.at(-1)?.interactive).toBe(true);
  });

  it('sends a drop message when the canvas reports one, for a seated player', async () => {
    const send = mock(() => {});
    let capturedOnDrop: ((col: number) => void) | undefined;
    mock.module('./ConnectFourCanvas', () => ({
      ConnectFourCanvas: (props: { onDrop: (col: number) => void }) => {
        capturedOnDrop = props.onDrop;
        return null;
      },
    }));
    const { ConnectFourRoomBoard } = await import(
      `./ConnectFourRoomBoard.tsx?${Math.random()}`
    );
    await act(async () => {
      render(
        <RoomConnectionContext.Provider value={baseValue({ send, role: 'player' })}>
          <ConnectFourRoomBoard />
        </RoomConnectionContext.Provider>,
      );
    });

    capturedOnDrop?.(3);

    expect(send).toHaveBeenCalledWith({ type: 'drop', payload: { col: 3 } });
  });
});
