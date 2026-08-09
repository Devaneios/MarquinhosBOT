import { Application, Container, Graphics, Text } from 'pixi.js';
import { useEffect, useRef } from 'react';
import type { BoardSnapshot, PublicCell } from './minesweeperProtocol';

const CELL_SIZE = 26;
const CELL_GAP = 2;
const BG_COLOR = '#17181a';
const HIDDEN_COLOR = '#2a2c30';
const HIDDEN_HOVER_COLOR = '#383b40';
const REVEALED_COLOR = '#1f2023';
const MINE_COLOR = '#7a1f1f';
const NUMBER_COLORS: Record<number, string> = {
  1: '#5fa8ff',
  2: '#5fbf77',
  3: '#e05d5d',
  4: '#9a6bd6',
  5: '#d68a3a',
  6: '#3ec9c9',
  7: '#e8e8e8',
  8: '#a0a0a0',
};

// PixiJS-rendered shared grid: every tile is its own interactive Graphics
// object (not a single canvas draw + hit-test), which keeps click handling
// simple — Pixi already knows which tile a pointer event landed on.
export function MinesweeperCanvas({
  board,
  onReveal,
}: {
  board: BoardSnapshot | null;
  onReveal: (x: number, y: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<Application | null>(null);
  const tilesRef = useRef<(Graphics | null)[][]>([]);
  const labelsRef = useRef<(Text | null)[][]>([]);
  const boardRef = useRef<BoardSnapshot | null>(null);
  const onRevealRef = useRef(onReveal);
  const applyBoardRef = useRef<((snapshot: BoardSnapshot) => void) | null>(
    null,
  );
  onRevealRef.current = onReveal;
  boardRef.current = board;

  useEffect(() => {
    const app = new Application();
    appRef.current = app;
    let cancelled = false;
    let initialized = false;
    let builtWidth = -1;
    let builtHeight = -1;
    let onContextLost: ((event: Event) => void) | null = null;
    let onContextRestored: (() => void) | null = null;
    let contextCanvas: HTMLCanvasElement | null = null;

    function onVisibilityChange() {
      if (!initialized) return;
      if (document.hidden) app.ticker.stop();
      else app.ticker.start();
    }
    document.addEventListener('visibilitychange', onVisibilityChange);

    function drawTile(cell: PublicCell, gfx: Graphics, hovered: boolean) {
      gfx.clear();
      const size = CELL_SIZE - CELL_GAP;
      if (!cell.revealed) {
        gfx
          .roundRect(0, 0, size, size, 4)
          .fill(hovered ? HIDDEN_HOVER_COLOR : HIDDEN_COLOR);
        return;
      }
      gfx
        .roundRect(0, 0, size, size, 4)
        .fill(cell.mine ? MINE_COLOR : REVEALED_COLOR);
    }

    function rebuildBoard(snapshot: BoardSnapshot) {
      app.stage.removeChildren();
      tilesRef.current = [];
      labelsRef.current = [];

      const gridContainer = new Container();
      for (let y = 0; y < snapshot.height; y++) {
        const tileRow: (Graphics | null)[] = [];
        const labelRow: (Text | null)[] = [];
        for (let x = 0; x < snapshot.width; x++) {
          const cell = snapshot.grid[y]?.[x] ?? { revealed: false };
          const gfx = new Graphics();
          gfx.position.set(x * CELL_SIZE, y * CELL_SIZE);
          gfx.eventMode = 'static';
          gfx.cursor = 'pointer';
          drawTile(cell, gfx, false);
          gfx.on('pointerover', () => {
            const current = boardRef.current?.grid[y]?.[x];
            if (current && !current.revealed) drawTile(current, gfx, true);
          });
          gfx.on('pointerout', () => {
            const current = boardRef.current?.grid[y]?.[x];
            if (current) drawTile(current, gfx, false);
          });
          gfx.on('pointertap', () => {
            const current = boardRef.current?.grid[y]?.[x];
            if (current?.revealed || boardRef.current?.gameOver) return;
            onRevealRef.current(x, y);
          });
          gridContainer.addChild(gfx);
          tileRow.push(gfx);

          let label: Text | null = null;
          if (cell.revealed && !cell.mine && cell.adjacent) {
            label = new Text({
              text: String(cell.adjacent),
              style: {
                fontSize: 14,
                fontWeight: 'bold',
                fill: NUMBER_COLORS[cell.adjacent] ?? '#e8e8e8',
              },
            });
            label.anchor.set(0.5);
            label.position.set(
              x * CELL_SIZE + (CELL_SIZE - CELL_GAP) / 2,
              y * CELL_SIZE + (CELL_SIZE - CELL_GAP) / 2,
            );
            gridContainer.addChild(label);
          }
          labelRow.push(label);
        }
        tilesRef.current.push(tileRow);
        labelsRef.current.push(labelRow);
      }
      app.stage.addChild(gridContainer);
      builtWidth = snapshot.width;
      builtHeight = snapshot.height;
    }

    function updateBoard(snapshot: BoardSnapshot) {
      if (snapshot.width !== builtWidth || snapshot.height !== builtHeight) {
        rebuildBoard(snapshot);
        return;
      }
      for (let y = 0; y < snapshot.height; y++) {
        for (let x = 0; x < snapshot.width; x++) {
          const cell = snapshot.grid[y]?.[x];
          const gfx = tilesRef.current[y]?.[x];
          if (!cell || !gfx) continue;
          const existingLabel = labelsRef.current[y]?.[x];
          if (existingLabel) continue; // already numbered, never changes back
          drawTile(cell, gfx, false);
          if (cell.revealed && !cell.mine && cell.adjacent) {
            const label = new Text({
              text: String(cell.adjacent),
              style: {
                fontSize: 14,
                fontWeight: 'bold',
                fill: NUMBER_COLORS[cell.adjacent] ?? '#e8e8e8',
              },
            });
            label.anchor.set(0.5);
            label.position.set(
              x * CELL_SIZE + (CELL_SIZE - CELL_GAP) / 2,
              y * CELL_SIZE + (CELL_SIZE - CELL_GAP) / 2,
            );
            app.stage.getChildAt(0).addChild(label);
            const row = labelsRef.current[y];
            if (row) row[x] = label;
          }
        }
      }
    }

    (async () => {
      // Same StrictMode double-invoke guard as PongCanvas: yield first so a
      // phantom first mount never calls app.init() on a canvas already
      // claimed by the real instance.
      await Promise.resolve();
      if (cancelled) return;

      const initialWidth = (board?.width ?? 16) * CELL_SIZE;
      const initialHeight = (board?.height ?? 16) * CELL_SIZE;
      await app.init({
        canvas: canvasRef.current!,
        width: initialWidth,
        height: initialHeight,
        background: BG_COLOR,
        antialias: true,
        resolution: window.devicePixelRatio,
        autoDensity: true,
      });
      if (cancelled) {
        app.destroy({ removeView: false });
        return;
      }
      initialized = true;

      onContextLost = (event: Event) => {
        event.preventDefault();
        app.ticker.stop();
      };
      onContextRestored = () => {
        app.ticker.start();
      };
      contextCanvas = canvasRef.current!;
      contextCanvas.addEventListener('webglcontextlost', onContextLost, false);
      contextCanvas.addEventListener(
        'webglcontextrestored',
        onContextRestored,
        false,
      );

      applyBoardRef.current = (snapshot: BoardSnapshot) => {
        if (snapshot.width !== builtWidth || snapshot.height !== builtHeight) {
          app.renderer.resize(
            snapshot.width * CELL_SIZE,
            snapshot.height * CELL_SIZE,
          );
        }
        updateBoard(snapshot);
      };

      if (boardRef.current) applyBoardRef.current(boardRef.current);
    })();

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (contextCanvas && onContextLost) {
        contextCanvas.removeEventListener('webglcontextlost', onContextLost);
      }
      if (contextCanvas && onContextRestored) {
        contextCanvas.removeEventListener(
          'webglcontextrestored',
          onContextRestored,
        );
      }
      if (initialized) {
        app.destroy({ removeView: false });
      }
      appRef.current = null;
      tilesRef.current = [];
      labelsRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (board) applyBoardRef.current?.(board);
  }, [board]);

  return (
    <canvas
      ref={canvasRef}
      className="block max-h-full max-w-full border border-marquinhos-border"
    />
  );
}
