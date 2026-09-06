import { describe, expect, it, mock } from 'bun:test';
import { act, render } from '@testing-library/react';
import { RoomConnectionContext } from '../../shared/RoomConnectionProvider';

interface CapturedCanvasProps {
  mode: string;
  canFire?: boolean;
  onClickOpponentCell?: (cell: { x: number; y: number }) => void;
}

let captured: CapturedCanvasProps[];

function installCanvasMock() {
  captured = [];
  mock.module('./BattleshipCanvas', () => ({
    BattleshipCanvas: (props: CapturedCanvasProps) => {
      captured.push(props);
      return null;
    },
  }));
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
      game: 'battleship' as const,
      hostUserId: 'me',
      queueEnabled: true,
      matchInProgress: true,
      members: [{ userId: 'me', role: 'player' as const }],
    },
    ...overrides,
  };
}

async function renderRoomBoard(value: NonNullable<React.ContextType<typeof RoomConnectionContext>>) {
  installCanvasMock();
  let deliver: ((message: { type: string; payload?: unknown }) => void) | null = null;
  const finalValue = {
    ...value,
    subscribe: (onMessage: (message: { type: string; payload?: unknown }) => void) => {
      deliver = onMessage;
      return () => {};
    },
  };
  const { BattleshipRoomBoard } = await import(`./BattleshipRoomBoard.tsx?${Math.random()}`);
  await act(async () => {
    render(
      <RoomConnectionContext.Provider value={finalValue}>
        <BattleshipRoomBoard />
      </RoomConnectionContext.Provider>,
    );
  });
  return {
    deliver: async (message: { type: string; payload?: unknown }) => {
      await act(async () => {
        deliver?.(message);
      });
    },
  };
}

const emptyBoard = { ships: [], shots: [] };

describe('BattleshipRoomBoard', () => {
  it('spectator: renders both fleets read-only, with no fire handler wired', async () => {
    const { deliver } = await renderRoomBoard(baseValue({ role: 'spectator' }));
    await deliver({
      type: 'state',
      payload: { phase: 'battle', turn: 'p1', winner: null, p1: emptyBoard, p2: emptyBoard, placementReady: { p1: true, p2: true } },
    });

    expect(captured).toHaveLength(2);
    for (const props of captured) {
      expect(props.canFire).toBe(false);
      expect(props.onClickOpponentCell).toBeUndefined();
    }
  });

  it('queued viewer: same read-only view as a spectator', async () => {
    const { deliver } = await renderRoomBoard(baseValue({ role: 'queued' }));
    await deliver({
      type: 'state',
      payload: { phase: 'battle', turn: 'p1', winner: null, p1: emptyBoard, p2: emptyBoard, placementReady: { p1: true, p2: true } },
    });

    expect(captured).toHaveLength(2);
    for (const props of captured) {
      expect(props.canFire).toBe(false);
    }
  });

  it('seated player on their turn: fire handler sends a fire message', async () => {
    const send = mock(() => {});
    const { deliver } = await renderRoomBoard(baseValue({ send, role: 'player' }));
    await deliver({ type: 'init', payload: { side: 'p1' } });
    await deliver({
      type: 'state',
      payload: { phase: 'battle', turn: 'p1', winner: null, own: emptyBoard, opponent: emptyBoard, placementReady: { p1: true, p2: true } },
    });

    const battleCanvas = captured.find((c) => c.mode === 'battle');
    expect(battleCanvas?.canFire).toBe(true);
    battleCanvas?.onClickOpponentCell?.({ x: 3, y: 4 });

    expect(send).toHaveBeenCalledWith({ type: 'fire', payload: { x: 3, y: 4 } });
  });

  it("seated player not on their turn: fire is disabled", async () => {
    const { deliver } = await renderRoomBoard(baseValue({ role: 'player' }));
    await deliver({ type: 'init', payload: { side: 'p2' } });
    await deliver({
      type: 'state',
      payload: { phase: 'battle', turn: 'p1', winner: null, own: emptyBoard, opponent: emptyBoard, placementReady: { p1: true, p2: true } },
    });

    const battleCanvas = captured.find((c) => c.mode === 'battle');
    expect(battleCanvas?.canFire).toBe(false);
  });
});
