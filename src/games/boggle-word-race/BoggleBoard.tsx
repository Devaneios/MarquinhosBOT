import { Application, Container, Graphics, Text } from 'pixi.js';
import { useEffect, useRef } from 'react';
import type { Cell } from './boggleProtocol';

const BOARD_SIZE = 4;
const TILE_SIZE = 90;
const TILE_GAP = 10;
const BOARD_PX =
  BOARD_SIZE * TILE_SIZE + (BOARD_SIZE - 1) * TILE_GAP + TILE_GAP * 2;

const TILE_BG = 0x232428;
const TILE_SELECTED_BG = 0xffb000;
const TILE_TEXT = '#e8e8e8';
const TILE_TEXT_SELECTED = '#1c1c1e';
const PATH_LINE_COLOR = 0xffb000;

function cellKey(cell: Cell): string {
  return `${cell.row},${cell.col}`;
}

function isAdjacent(a: Cell, b: Cell): boolean {
  const dr = Math.abs(a.row - b.row);
  const dc = Math.abs(a.col - b.col);
  return dr <= 1 && dc <= 1 && !(dr === 0 && dc === 0);
}

function tileCenter(cell: Cell): { x: number; y: number } {
  return {
    x: TILE_GAP + cell.col * (TILE_SIZE + TILE_GAP) + TILE_SIZE / 2,
    y: TILE_GAP + cell.row * (TILE_SIZE + TILE_GAP) + TILE_SIZE / 2,
  };
}

export function BoggleBoard({
  grid,
  disabled,
  onSubmit,
}: {
  grid: string[][];
  disabled: boolean;
  onSubmit: (path: Cell[]) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<Application | null>(null);
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;
  const gridRef = useRef(grid);
  gridRef.current = grid;

  useEffect(() => {
    let cancelled = false;
    let onGlobalPointerUp: (() => void) | null = null;
    const app = new Application();
    appRef.current = app;

    (async () => {
      await Promise.resolve();
      if (cancelled) return;

      await app.init({
        canvas: canvasRef.current!,
        width: BOARD_PX,
        height: BOARD_PX,
        background: '#17181a',
        antialias: true,
        resolution: window.devicePixelRatio,
        autoDensity: true,
      });
      if (cancelled) {
        app.destroy({ removeView: false });
        return;
      }

      const tiles = new Container();
      const pathLine = new Graphics();
      app.stage.addChild(pathLine, tiles);

      const tileGraphics: Graphics[][] = [];
      const tileLabels: Text[][] = [];

      let selecting = false;
      let path: Cell[] = [];

      function drawTile(cell: Cell, selected: boolean) {
        const gfx = tileGraphics[cell.row]![cell.col]!;
        const { x, y } = tileCenter(cell);
        gfx.clear();
        gfx
          .roundRect(-TILE_SIZE / 2, -TILE_SIZE / 2, TILE_SIZE, TILE_SIZE, 10)
          .fill(selected ? TILE_SELECTED_BG : TILE_BG);
        gfx.position.set(x, y);
        const label = tileLabels[cell.row]![cell.col]!;
        label.style.fill = selected ? TILE_TEXT_SELECTED : TILE_TEXT;
      }

      function redrawSelection() {
        for (let row = 0; row < BOARD_SIZE; row++) {
          for (let col = 0; col < BOARD_SIZE; col++) {
            const selected = path.some((c) => c.row === row && c.col === col);
            drawTile({ row, col }, selected);
          }
        }
        pathLine.clear();
        if (path.length > 1) {
          const first = tileCenter(path[0]!);
          pathLine.moveTo(first.x, first.y);
          for (let i = 1; i < path.length; i++) {
            const p = tileCenter(path[i]!);
            pathLine.lineTo(p.x, p.y);
          }
          pathLine.stroke({ width: 6, color: PATH_LINE_COLOR, alpha: 0.6 });
        }
      }

      function endSelection() {
        if (!selecting) return;
        selecting = false;
        if (path.length >= 3) onSubmitRef.current(path);
        path = [];
        redrawSelection();
      }

      function tryExtend(cell: Cell) {
        if (!selecting || disabledRef.current) return;
        const last = path[path.length - 1];
        if (path.some((c) => cellKey(c) === cellKey(cell))) {
          // Backtracking onto the previous cell shrinks the path by one,
          // mirroring how mobile Boggle apps let you undo a step mid-drag
          // without lifting your finger.
          const idx = path.findIndex((c) => cellKey(c) === cellKey(cell));
          if (idx === path.length - 2) path = path.slice(0, path.length - 1);
          redrawSelection();
          return;
        }
        if (last && !isAdjacent(last, cell)) return;
        path.push(cell);
        redrawSelection();
      }

      for (let row = 0; row < BOARD_SIZE; row++) {
        tileGraphics.push([]);
        tileLabels.push([]);
        for (let col = 0; col < BOARD_SIZE; col++) {
          const gfx = new Graphics();
          gfx.eventMode = 'static';
          gfx.cursor = 'pointer';
          const label = new Text({
            text: gridRef.current[row]?.[col] ?? '',
            style: {
              fontFamily: 'monospace',
              fontSize: 36,
              fontWeight: 'bold',
              fill: TILE_TEXT,
            },
          });
          label.anchor.set(0.5);
          const { x, y } = tileCenter({ row, col });
          label.position.set(x, y);

          gfx.on('pointerdown', () => {
            if (disabledRef.current) return;
            selecting = true;
            path = [{ row, col }];
            redrawSelection();
          });
          gfx.on('pointerenter', () => tryExtend({ row, col }));

          tileGraphics[row]!.push(gfx);
          tileLabels[row]!.push(label);
          tiles.addChild(gfx, label);
        }
      }

      redrawSelection();

      onGlobalPointerUp = () => endSelection();
      app.stage.eventMode = 'static';
      app.stage.hitArea = app.screen;
      app.stage.on('pointerup', onGlobalPointerUp);
      app.stage.on('pointerupoutside', onGlobalPointerUp);
    })();

    return () => {
      cancelled = true;
      const app = appRef.current;
      if (app?.renderer) {
        if (onGlobalPointerUp) {
          app.stage.off('pointerup', onGlobalPointerUp);
          app.stage.off('pointerupoutside', onGlobalPointerUp);
        }
        app.destroy({ removeView: false });
      }
      appRef.current = null;
    };
    // Rebuilding the whole board for a new grid is intentional and cheap
    // (one round per session, at most one grid) — no need for granular
    // per-tile updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid]);

  return (
    <canvas
      ref={canvasRef}
      className="block max-h-full max-w-full border border-marquinhos-border"
    />
  );
}
