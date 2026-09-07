import { act, render } from '@testing-library/react';
import { describe, expect, it, mock } from 'bun:test';

interface FakeGraphics {
  handlers: Record<string, () => void>;
  eventMode: string;
  cursor: string;
  children: unknown[];
}

let createdGraphics: FakeGraphics[];

function installPixiMock() {
  createdGraphics = [];
  mock.module('pixi.js', () => {
    class Graphics implements FakeGraphics {
      handlers: Record<string, () => void> = {};
      eventMode = '';
      cursor = '';
      children: unknown[] = [];
      rect() {
        return this;
      }
      stroke() {
        return this;
      }
      fill() {
        return this;
      }
      on(event: string, cb: () => void) {
        this.handlers[event] = cb;
        return this;
      }
      addChild(child: unknown) {
        this.children.push(child);
      }
      constructor() {
        createdGraphics.push(this);
      }
    }
    class Text {
      text = '';
      style: Record<string, unknown> = {};
      visible = false;
      position = { set: () => {} };
    }
    class Application {
      stage = { addChild: () => {} };
      ticker = { start() {}, stop() {} };
      async init() {}
      destroy() {}
    }
    return { Application, Graphics, Text };
  });
}

async function renderCanvas(props: {
  role: 'player' | 'spectator' | 'queued' | null;
  onMove: (row: number, col: number) => void;
}) {
  installPixiMock();
  const { TicTacToeCanvas } = await import(
    `./TicTacToeCanvas.tsx?${Math.random()}`
  );
  await act(async () => {
    render(
      <TicTacToeCanvas
        state={{
          board: [
            [null, null, null],
            [null, null, null],
            [null, null, null],
          ],
          currentPlayer: 'X',
          winner: null,
          isDraw: false,
          moveCount: 0,
        }}
        player="X"
        gameOver={false}
        role={props.role}
        onMove={props.onMove}
      />,
    );
    // The component yields one microtask (React 19 StrictMode phantom-mount
    // guard) before calling pixi's async init() — flush it so the cells are
    // actually created before we look for them.
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('TicTacToeCanvas move gating', () => {
  it('does not send a move when the viewer is a spectator, even on their nominal turn', async () => {
    const onMove = mock((_row: number, _col: number) => {});
    await renderCanvas({ role: 'spectator', onMove });

    createdGraphics[0]?.handlers.pointerdown?.();

    expect(onMove).not.toHaveBeenCalled();
  });

  it('does not send a move when the viewer is queued', async () => {
    const onMove = mock((_row: number, _col: number) => {});
    await renderCanvas({ role: 'queued', onMove });

    createdGraphics[0]?.handlers.pointerdown?.();

    expect(onMove).not.toHaveBeenCalled();
  });

  it('sends a move for a seated player on their turn', async () => {
    const onMove = mock((_row: number, _col: number) => {});
    await renderCanvas({ role: 'player', onMove });

    createdGraphics[0]?.handlers.pointerdown?.();

    expect(onMove).toHaveBeenCalledWith(0, 0);
  });

  it('sends a move when role is null (the existing non-room single/direct-connect path)', async () => {
    const onMove = mock((_row: number, _col: number) => {});
    await renderCanvas({ role: null, onMove });

    createdGraphics[0]?.handlers.pointerdown?.();

    expect(onMove).toHaveBeenCalledWith(0, 0);
  });
});
