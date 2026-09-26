import { RoomConnectionContext } from '@/realtime/RoomConnectionContext';
import { act, render } from '@testing-library/react';
import { describe, expect, it, mock } from 'bun:test';

type CanvasProps = { interactive: boolean; onDrop: (col: number) => void };

const capturedProps: CanvasProps[] = [];

mock.module('./ConnectFourCanvas', () => ({
  ConnectFourCanvas: (props: CanvasProps) => {
    capturedProps.push({
      interactive: props.interactive,
      onDrop: props.onDrop,
    });
    return null;
  },
}));

async function renderRoomBoard(
  value: React.ContextType<typeof RoomConnectionContext>,
) {
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
    let deliver:
      ((message: { type: string; payload?: unknown }) => void) | null = null;
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
    await renderRoomBoard(baseValue({ send, role: 'player' }));

    capturedProps.at(-1)?.onDrop(3);

    expect(send).toHaveBeenCalledWith({ type: 'drop', payload: { col: 3 } });
  });
});
