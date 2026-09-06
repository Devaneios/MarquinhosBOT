import { describe, expect, it, mock } from 'bun:test';
import { act, render } from '@testing-library/react';
import type { TowerState } from '../types';

interface FakeGraphics {
  handlers: Record<string, () => void>;
  eventMode: string;
  cursor: string;
}

let createdGraphics: FakeGraphics[];

function installPixiMock() {
  createdGraphics = [];
  mock.module('pixi.js', () => {
    class Graphics implements FakeGraphics {
      handlers: Record<string, () => void> = {};
      eventMode = '';
      cursor = '';
      roundRect() {
        return this;
      }
      fill() {
        return this;
      }
      position = { set: () => {} };
      on(event: string, cb: () => void) {
        this.handlers[event] = cb;
      }
      constructor() {
        createdGraphics.push(this);
      }
    }
    class Application {
      stage = { removeChildren: () => {}, addChild: () => {}, position: { set: () => {} } };
      // The real pixi ticker calls its registered fn every frame;
      // TowerBoardCanvas only ever renders through that callback (no
      // synchronous initial render like some other games' canvases), so
      // this fake invokes it once immediately to simulate a single frame.
      ticker = {
        start() {},
        stop() {},
        add(fn: () => void) {
          fn();
        },
        remove() {},
      };
      async init() {}
      destroy() {}
    }
    return { Application, Graphics };
  });
}

// Level index 0 is only "eligible" (per TowerBoardCanvas's `i < totalLevels
// - 2` rule — the top two levels are never eligible, matching Jenga's real
// rule) when there are at least 3 levels total, so this fixture needs 3.
const stateOnMyTurn: TowerState = {
  status: 'playing',
  levels: [
    { present: [true, true, true] },
    { present: [true, true, true] },
    { present: [true, true, true] },
  ],
  currentPlayer: 'user-a',
  turnOrder: ['user-a', 'user-b'],
  eliminated: [],
  winner: null,
  lastPull: null,
  pendingBlocks: 0,
  totalRemoved: 0,
  totalBlocksOriginal: 9,
  eligibleLevelCount: 1,
};

async function renderCanvas(props: {
  role: 'player' | 'spectator' | 'queued' | null;
  onPull: (level: number, position: number) => void;
}) {
  installPixiMock();
  const { TowerBoardCanvas } = await import(`./TowerBoardCanvas.tsx?${Math.random()}`);
  await act(async () => {
    render(
      <TowerBoardCanvas
        state={stateOnMyTurn}
        userId="user-a"
        role={props.role}
        onPull={props.onPull}
      />,
    );
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('TowerBoardCanvas pull gating', () => {
  it('does not pull a block when the viewer is a spectator, even on their nominal turn', async () => {
    const onPull = mock((_l: number, _p: number) => {});
    await renderCanvas({ role: 'spectator', onPull });

    const eligible = createdGraphics.find((g) => g.handlers.pointerdown);
    expect(eligible).toBeUndefined(); // spectator: no eligible block gets a handler at all
    expect(onPull).not.toHaveBeenCalled();
  });

  it('does not pull a block when the viewer is queued', async () => {
    const onPull = mock((_l: number, _p: number) => {});
    await renderCanvas({ role: 'queued', onPull });

    const eligible = createdGraphics.find((g) => g.handlers.pointerdown);
    expect(eligible).toBeUndefined();
    expect(onPull).not.toHaveBeenCalled();
  });

  it('pulls a block for a seated player on their turn', async () => {
    const onPull = mock((_l: number, _p: number) => {});
    await renderCanvas({ role: 'player', onPull });

    const eligible = createdGraphics.find((g) => g.handlers.pointerdown);
    expect(eligible).toBeTruthy();
    eligible?.handlers.pointerdown?.();

    expect(onPull).toHaveBeenCalled();
  });
});
