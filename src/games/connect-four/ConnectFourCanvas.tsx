import { Application, Graphics } from 'pixi.js';
import { useEffect, useRef } from 'react';
import type { ConnectFourState, Disc } from './types';

const COLS = 7;
const ROWS = 6;
const CELL = 72;
const PADDING = 16;
const BOARD_BG = '#1c3f6e';
const HOLE_BG = '#17181a';
const P1_COLOR = 0xffb000;
const P2_COLOR = 0x5fbf77;
const WINNING_HIGHLIGHT = 0xffffff;

const BOARD_WIDTH = COLS * CELL + PADDING * 2;
const BOARD_HEIGHT = ROWS * CELL + PADDING * 2;

function discColor(disc: Disc): number {
  return disc === 'p1' ? P1_COLOR : P2_COLOR;
}

function cellCenter(row: number, col: number): { x: number; y: number } {
  return {
    x: PADDING + col * CELL + CELL / 2,
    y: PADDING + row * CELL + CELL / 2,
  };
}

export function ConnectFourCanvas({
  state,
  onDrop,
  interactive,
}: {
  state: ConnectFourState | null;
  onDrop: (col: number) => void;
  interactive: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const discsRef = useRef<Graphics | null>(null);
  const hoverRef = useRef<Graphics | null>(null);
  const redrawRef = useRef<(() => void) | null>(null);
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;
  const stateRef = useRef(state);
  stateRef.current = state;
  const interactiveRef = useRef(interactive);
  interactiveRef.current = interactive;

  useEffect(() => {
    let cancelled = false;
    const app = new Application();
    appRef.current = app;

    let onPointerMove: ((e: PointerEvent) => void) | null = null;
    let onPointerLeave: (() => void) | null = null;
    let onClick: ((e: MouseEvent) => void) | null = null;
    let canvasEl: HTMLCanvasElement | null = null;

    function drawHover(col: number | null) {
      const hover = hoverRef.current;
      if (!hover) return;
      hover.clear();
      if (col === null || !interactiveRef.current) return;
      const s = stateRef.current;
      if (!s || s.winner || s.isDraw) return;
      if (s.grid[0]![col] !== null) return;
      const { x } = cellCenter(0, col);
      hover
        .circle(x, PADDING - CELL / 2 + 8, CELL / 2 - 10)
        .fill({ color: discColor(s.currentTurn), alpha: 0.35 });
    }

    function redraw() {
      const discs = discsRef.current;
      const s = stateRef.current;
      if (!discs || !s) return;
      discs.clear();
      const winningCells = new Set(
        (s.winningLine ?? []).map((c) => `${c.row}:${c.col}`),
      );
      for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
          const disc = s.grid[row]![col];
          if (!disc) continue;
          const { x, y } = cellCenter(row, col);
          const isWinning = winningCells.has(`${row}:${col}`);
          discs.circle(x, y, CELL / 2 - 6).fill(discColor(disc));
          if (isWinning) {
            discs
              .circle(x, y, CELL / 2 - 6)
              .stroke({ width: 3, color: WINNING_HIGHLIGHT });
          }
        }
      }
    }
    redrawRef.current = redraw;

    (async () => {
      // Mirrors PongCanvas: React 19 StrictMode double-invokes this effect
      // before any await settles, so bail here if the phantom first pass's
      // cleanup already ran.
      await Promise.resolve();
      if (cancelled) return;

      await app.init({
        canvas: canvasRef.current!,
        width: BOARD_WIDTH,
        height: BOARD_HEIGHT,
        background: BOARD_BG,
        antialias: true,
        resolution: window.devicePixelRatio,
        autoDensity: true,
      });
      if (cancelled) {
        app.destroy({ removeView: false });
        return;
      }

      const board = new Graphics();
      for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
          const { x, y } = cellCenter(row, col);
          board.circle(x, y, CELL / 2 - 6).fill(HOLE_BG);
        }
      }
      app.stage.addChild(board);

      const discs = new Graphics();
      discsRef.current = discs;
      app.stage.addChild(discs);

      const hover = new Graphics();
      hoverRef.current = hover;
      app.stage.addChild(hover);

      redraw();

      canvasEl = canvasRef.current;
      const columnFromX = (clientX: number): number | null => {
        if (!canvasEl) return null;
        const rect = canvasEl.getBoundingClientRect();
        const scale = BOARD_WIDTH / rect.width;
        const localX = (clientX - rect.left) * scale;
        const col = Math.floor((localX - PADDING) / CELL);
        return col >= 0 && col < COLS ? col : null;
      };

      onPointerMove = (e: PointerEvent) => {
        drawHover(columnFromX(e.clientX));
      };
      onPointerLeave = () => drawHover(null);
      onClick = (e: MouseEvent) => {
        if (!interactiveRef.current) return;
        const col = columnFromX(e.clientX);
        if (col !== null) onDropRef.current(col);
      };

      canvasEl?.addEventListener('pointermove', onPointerMove);
      canvasEl?.addEventListener('pointerleave', onPointerLeave);
      canvasEl?.addEventListener('click', onClick);
    })();

    return () => {
      cancelled = true;
      if (canvasEl) {
        if (onPointerMove)
          canvasEl.removeEventListener('pointermove', onPointerMove);
        if (onPointerLeave)
          canvasEl.removeEventListener('pointerleave', onPointerLeave);
        if (onClick) canvasEl.removeEventListener('click', onClick);
      }
      if (app.renderer) app.destroy({ removeView: false });
      appRef.current = null;
      discsRef.current = null;
      hoverRef.current = null;
      redrawRef.current = null;
    };
  }, []);

  useEffect(() => {
    redrawRef.current?.();
  }, [state]);

  return (
    <canvas
      ref={canvasRef}
      className="block max-h-full max-w-full cursor-pointer border border-marquinhos-border"
    />
  );
}
