import { act, render } from '@testing-library/react';
import { describe, expect, it, mock } from 'bun:test';
import type { CheckersState } from '../types';

function installPixiMock() {
  mock.module('pixi.js', () => {
    class Graphics {
      rect() {
        return this;
      }
      fill() {
        return this;
      }
      stroke() {
        return this;
      }
      circle() {
        return this;
      }
    }
    class Container {
      removeChildren() {}
      addChild() {}
    }
    class Application {
      stage = { addChild: () => {} };
      ticker = { start() {}, stop() {} };
      async init() {}
      destroy() {}
    }
    return { Application, Container, Graphics };
  });
}

const stateWithForcedContinuation: CheckersState = {
  board: Array.from({ length: 8 }, () => Array(8).fill(null)),
  turn: 'black',
  winner: null,
  mustContinueFrom: { row: 2, col: 2 },
};

async function renderCanvas(props: {
  role: 'player' | 'spectator' | 'queued' | null;
  onMove: (
    from: { row: number; col: number },
    to: { row: number; col: number },
  ) => void;
}) {
  installPixiMock();
  const { CheckersCanvas } = await import(
    `./CheckersCanvas.tsx?${Math.random()}`
  );
  const { container } = await (async () => {
    let result: ReturnType<typeof render> | null = null;
    await act(async () => {
      result = render(
        <CheckersCanvas
          state={stateWithForcedContinuation}
          myColor="black"
          role={props.role}
          onMove={props.onMove}
        />,
      );
      await Promise.resolve();
      await Promise.resolve();
    });
    return result!;
  })();

  const canvas = container.querySelector('canvas')!;
  Object.defineProperty(canvas, 'getBoundingClientRect', {
    value: () => ({
      left: 0,
      top: 0,
      width: 480,
      height: 480,
      right: 480,
      bottom: 480,
    }),
    configurable: true,
  });
  return canvas;
}

describe('CheckersCanvas move gating (forced-continuation click)', () => {
  it('does not send a move when the viewer is a spectator', async () => {
    const onMove = mock(() => {});
    const canvas = await renderCanvas({ role: 'spectator', onMove });

    canvas.dispatchEvent(
      new PointerEvent('pointerdown', {
        clientX: 190,
        clientY: 190,
        bubbles: true,
      }),
    );

    expect(onMove).not.toHaveBeenCalled();
  });

  it('does not send a move when the viewer is queued', async () => {
    const onMove = mock(() => {});
    const canvas = await renderCanvas({ role: 'queued', onMove });

    canvas.dispatchEvent(
      new PointerEvent('pointerdown', {
        clientX: 190,
        clientY: 190,
        bubbles: true,
      }),
    );

    expect(onMove).not.toHaveBeenCalled();
  });

  it('sends a move for a seated player on their turn', async () => {
    const onMove = mock(() => {});
    const canvas = await renderCanvas({ role: 'player', onMove });

    canvas.dispatchEvent(
      new PointerEvent('pointerdown', {
        clientX: 190,
        clientY: 190,
        bubbles: true,
      }),
    );

    expect(onMove).toHaveBeenCalledWith({ row: 2, col: 2 }, { row: 3, col: 3 });
  });

  it('sends a move when role is null (the existing non-room path)', async () => {
    const onMove = mock(() => {});
    const canvas = await renderCanvas({ role: null, onMove });

    canvas.dispatchEvent(
      new PointerEvent('pointerdown', {
        clientX: 190,
        clientY: 190,
        bubbles: true,
      }),
    );

    expect(onMove).toHaveBeenCalledWith({ row: 2, col: 2 }, { row: 3, col: 3 });
  });
});
