import { Application, Container, Graphics, Text } from 'pixi.js';
import { useEffect, useRef } from 'react';

export interface Cell {
  row: number;
  col: number;
}

export interface FoundWord {
  word: string;
  userId: string;
  start: Cell;
  end: Cell;
}

const CELL_SIZE = 32;
const GRID_BG = '#17181a';
const CELL_TEXT_COLOR = '#e8e8e8';
const DRAG_COLOR = '#ffb000';
const PLAYER_PALETTE = [
  '#ffb000',
  '#5fbf77',
  '#5f9bbf',
  '#bf5f9b',
  '#bf9b5f',
  '#9b5fbf',
  '#5fbfaa',
  '#bf5f5f',
];

export function colorForPlayer(userId: string, selfId: string): string {
  if (userId === selfId) return DRAG_COLOR;
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return PLAYER_PALETTE[hash % PLAYER_PALETTE.length]!;
}

// Snaps a raw drag endpoint onto the nearest of the 8 straight-line
// directions from `start` — dragging slightly off-axis still selects a
// clean horizontal/vertical/diagonal run instead of an invalid line the
// server would reject.
function snapToLine(start: Cell, raw: Cell): Cell {
  const dr = raw.row - start.row;
  const dc = raw.col - start.col;
  const ar = Math.abs(dr);
  const ac = Math.abs(dc);
  if (ar === 0 && ac === 0) return start;

  let dirR = dr === 0 ? 0 : Math.sign(dr);
  let dirC = dc === 0 ? 0 : Math.sign(dc);
  let steps = Math.max(ar, ac);

  if (dirR !== 0 && dirC !== 0 && ar !== ac) {
    if (ar > ac) dirC = 0;
    else dirR = 0;
    steps = dirR === 0 || dirC === 0 ? Math.max(ar, ac) : Math.min(ar, ac);
  }

  return { row: start.row + dirR * steps, col: start.col + dirC * steps };
}

export function WordSearchRaceCanvas({
  grid,
  size,
  found,
  selfId,
  onSelect,
}: {
  grid: string[][];
  size: number;
  found: FoundWord[];
  selfId: string;
  onSelect: (start: Cell, end: Cell) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<Application | null>(null);
  const gridRef = useRef(grid);
  const foundRef = useRef(found);
  const selfIdRef = useRef(selfId);
  const onSelectRef = useRef(onSelect);
  const redrawFoundRef = useRef<(() => void) | null>(null);
  gridRef.current = grid;
  foundRef.current = found;
  selfIdRef.current = selfId;
  onSelectRef.current = onSelect;

  useEffect(() => {
    const app = new Application();
    appRef.current = app;
    let cancelled = false;
    let cellContainer: Container | null = null;
    let selectionGfx: Graphics | null = null;
    let foundGfx: Graphics | null = null;
    let dragging = false;
    let dragStart: Cell | null = null;
    let dragEnd: Cell | null = null;

    function drawFound() {
      if (!foundGfx) return;
      foundGfx.clear();
      for (const entry of foundRef.current) {
        drawLine(foundGfx, entry.start, entry.end, colorForPlayer(entry.userId, selfIdRef.current), 0.35);
      }
    }

    function drawLine(gfx: Graphics, start: Cell, end: Cell, color: string, alpha: number) {
      const dr = Math.sign(end.row - start.row);
      const dc = Math.sign(end.col - start.col);
      const steps = Math.max(Math.abs(end.row - start.row), Math.abs(end.col - start.col));
      for (let i = 0; i <= steps; i++) {
        const row = start.row + dr * i;
        const col = start.col + dc * i;
        gfx
          .roundRect(col * CELL_SIZE + 2, row * CELL_SIZE + 2, CELL_SIZE - 4, CELL_SIZE - 4, 6)
          .fill({ color, alpha });
      }
    }

    function cellAt(localX: number, localY: number): Cell {
      const col = Math.floor(localX / CELL_SIZE);
      const row = Math.floor(localY / CELL_SIZE);
      const clampedRow = Math.min(Math.max(row, 0), size - 1);
      const clampedCol = Math.min(Math.max(col, 0), size - 1);
      return { row: clampedRow, col: clampedCol };
    }

    function redrawSelection() {
      if (!selectionGfx) return;
      selectionGfx.clear();
      if (dragStart && dragEnd) {
        drawLine(selectionGfx, dragStart, dragEnd, DRAG_COLOR, 0.5);
      }
    }

    (async () => {
      await Promise.resolve();
      if (cancelled) return;

      await app.init({
        canvas: canvasRef.current!,
        width: size * CELL_SIZE,
        height: size * CELL_SIZE,
        background: GRID_BG,
        antialias: true,
        resolution: window.devicePixelRatio,
        autoDensity: true,
      });
      if (cancelled) {
        app.destroy({ removeView: false });
        return;
      }

      foundGfx = new Graphics();
      selectionGfx = new Graphics();
      cellContainer = new Container();
      app.stage.addChild(foundGfx, selectionGfx, cellContainer);

      for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
          const letter = gridRef.current[row]?.[col] ?? '';
          const text = new Text({
            text: letter,
            style: { fontFamily: 'monospace', fontSize: 16, fill: CELL_TEXT_COLOR },
          });
          text.anchor.set(0.5);
          text.position.set(col * CELL_SIZE + CELL_SIZE / 2, row * CELL_SIZE + CELL_SIZE / 2);
          cellContainer.addChild(text);
        }
      }

      redrawFoundRef.current = drawFound;
      drawFound();

      app.stage.eventMode = 'static';
      app.stage.hitArea = app.screen;

      app.stage.on('pointerdown', (event) => {
        const local = app.stage.toLocal(event.global);
        dragging = true;
        dragStart = cellAt(local.x, local.y);
        dragEnd = dragStart;
        redrawSelection();
      });
      app.stage.on('pointermove', (event) => {
        if (!dragging || !dragStart) return;
        const local = app.stage.toLocal(event.global);
        const raw = cellAt(local.x, local.y);
        dragEnd = snapToLine(dragStart, raw);
        redrawSelection();
      });
      const finishDrag = () => {
        if (dragging && dragStart && dragEnd) {
          if (dragStart.row !== dragEnd.row || dragStart.col !== dragEnd.col) {
            onSelectRef.current(dragStart, dragEnd);
          }
        }
        dragging = false;
        dragStart = null;
        dragEnd = null;
        redrawSelection();
      };
      app.stage.on('pointerup', finishDrag);
      app.stage.on('pointerupoutside', finishDrag);
    })();

    return () => {
      cancelled = true;
      redrawFoundRef.current = null;
      appRef.current = null;
      app.destroy({ removeView: false }, { children: true, texture: true });
    };
    // Grid dimensions never change mid-game; found/selection redraws are
    // handled imperatively via the refs above so this effect only ever
    // needs to run once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size]);

  useEffect(() => {
    redrawFoundRef.current?.();
  }, [found]);

  return (
    <canvas
      ref={canvasRef}
      className="block max-h-full max-w-full border border-marquinhos-border"
    />
  );
}
