import { Application, Container, Graphics } from 'pixi.js';
import { useEffect, useRef } from 'react';
import {
  legalEndsFor,
  tileMatches,
  type DominoesClientState,
  type Tile,
} from '../protocol';

const TILE_W = 44;
const TILE_H = 72;
const CHAIN_TILE_W = 56;
const CHAIN_TILE_H = 34;
const HAND_GAP = 10;
const CHAIN_GAP = 4;
const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 360;
const BG_COLOR = 0x17181a;
const TILE_COLOR = 0xf2ede3;
const TILE_SELECTED_COLOR = 0xffb000;
const TILE_DISABLED_COLOR = 0x4a4a4c;
const TILE_BORDER = 0x1c1c1e;
const PIP_COLOR = 0x1c1c1e;

function drawTileFace(
  gfx: Graphics,
  width: number,
  height: number,
  fill: number,
) {
  gfx
    .clear()
    .roundRect(0, 0, width, height, 6)
    .fill(fill)
    .stroke({ width: 2, color: TILE_BORDER });
}

const PIP_LAYOUTS: Record<number, [number, number][]> = {
  0: [],
  1: [[1, 1]],
  2: [
    [0, 0],
    [2, 2],
  ],
  3: [
    [0, 0],
    [1, 1],
    [2, 2],
  ],
  4: [
    [0, 0],
    [0, 2],
    [2, 0],
    [2, 2],
  ],
  5: [
    [0, 0],
    [0, 2],
    [1, 1],
    [2, 0],
    [2, 2],
  ],
  6: [
    [0, 0],
    [1, 0],
    [2, 0],
    [0, 2],
    [1, 2],
    [2, 2],
  ],
};

function drawPips(
  gfx: Graphics,
  value: number,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const pad = Math.min(w, h) * 0.16;
  const cellW = (w - pad * 2) / 2;
  const cellH = (h - pad * 2) / 2;
  const radius = Math.min(cellW, cellH) * 0.28;
  for (const [col, row] of PIP_LAYOUTS[value] ?? []) {
    const px = x + pad + cellW * (col / 2);
    const py = y + pad + cellH * (row / 2);
    gfx.circle(px, py, radius).fill(PIP_COLOR);
  }
}

interface ChainPoolEntry {
  container: Container;
  gfx: Graphics;
  divider: Graphics;
}

interface HandPoolEntry {
  container: Container;
  gfx: Graphics;
  divider: Graphics;
  tile: Tile | null;
}

export interface DominoesBlockCanvasProps {
  state: DominoesClientState | null;
  selfId: string;
  selectedTile: Tile | null;
  onTileClick: (tile: Tile) => void;
  // 'player' | null both permit input; 'spectator'/'queued' block it. Belt
  // and suspenders here — current.currentPlayer will never equal a
  // spectator's own userId either way (spectators are never registered as
  // a player, so the existing isMyTurn check already excludes them) — but
  // this mirrors every other room-board's explicit gate rather than relying
  // solely on that coincidence.
  role?: 'player' | 'spectator' | 'queued' | null;
}

export function DominoesBlockCanvas({
  state,
  selfId,
  selectedTile,
  onTileClick,
  role = null,
}: DominoesBlockCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<Application | null>(null);
  const stateRef = useRef<DominoesClientState | null>(state);
  stateRef.current = state;
  const selfIdRef = useRef(selfId);
  selfIdRef.current = selfId;
  const selectedTileRef = useRef(selectedTile);
  selectedTileRef.current = selectedTile;
  const roleRef = useRef(role);
  roleRef.current = role;
  const onTileClickRef = useRef(onTileClick);
  onTileClickRef.current = onTileClick;
  const renderRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let cancelled = false;
    let initialized = false;
    const app = new Application();
    appRef.current = app;
    let chainContainer: Container | null = null;
    let handContainer: Container | null = null;
    const chainPool: ChainPoolEntry[] = [];
    const handPool: HandPoolEntry[] = [];
    let onContextLost: ((event: Event) => void) | null = null;
    let onContextRestored: (() => void) | null = null;
    let contextCanvas: HTMLCanvasElement | null = null;

    function onVisibilityChange() {
      if (!initialized) return;
      if (document.hidden) app.ticker.stop();
      else app.ticker.start();
    }
    document.addEventListener('visibilitychange', onVisibilityChange);

    (async () => {
      await Promise.resolve();
      if (cancelled) return;

      await app.init({
        canvas: canvasRef.current!,
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
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

      chainContainer = new Container();
      handContainer = new Container();
      app.stage.addChild(chainContainer, handContainer);

      function getChainEntry(index: number): ChainPoolEntry {
        let entry = chainPool[index];
        if (!entry) {
          const container = new Container();
          const gfx = new Graphics();
          const divider = new Graphics()
            .moveTo(CHAIN_TILE_W / 2, 2)
            .lineTo(CHAIN_TILE_W / 2, CHAIN_TILE_H - 2)
            .stroke({ width: 1, color: TILE_BORDER });
          container.addChild(gfx, divider);
          entry = { container, gfx, divider };
          chainPool[index] = entry;
          chainContainer!.addChild(container);
        }
        return entry;
      }

      function getHandEntry(index: number): HandPoolEntry {
        let entry = handPool[index];
        if (!entry) {
          const container = new Container();
          const gfx = new Graphics();
          const divider = new Graphics()
            .moveTo(2, TILE_H / 2)
            .lineTo(TILE_W - 2, TILE_H / 2)
            .stroke({ width: 1, color: TILE_BORDER });
          container.addChild(gfx, divider);
          entry = { container, gfx, divider, tile: null };
          const currentEntry = entry;
          container.on('pointertap', () => {
            if (roleRef.current === 'spectator' || roleRef.current === 'queued')
              return;
            if (currentEntry.tile) onTileClickRef.current(currentEntry.tile);
          });
          handPool[index] = entry;
          handContainer!.addChild(container);
        }
        return entry;
      }

      function render() {
        const current = stateRef.current;
        if (!chainContainer || !handContainer) return;
        if (!current) {
          for (const entry of chainPool) entry.container.visible = false;
          for (const entry of handPool) {
            entry.container.visible = false;
            entry.tile = null;
          }
          return;
        }

        const chainWidth =
          current.chain.length * (CHAIN_TILE_W + CHAIN_GAP) - CHAIN_GAP;
        let cx = (CANVAS_WIDTH - chainWidth) / 2;
        const cy = 60;
        current.chain.forEach((tile, index) => {
          const entry = getChainEntry(index);
          entry.container.visible = true;
          entry.container.position.set(cx, cy);
          drawTileFace(entry.gfx, CHAIN_TILE_W, CHAIN_TILE_H, TILE_COLOR);
          drawPips(entry.gfx, tile.a, 0, 0, CHAIN_TILE_W / 2, CHAIN_TILE_H);
          drawPips(
            entry.gfx,
            tile.b,
            CHAIN_TILE_W / 2,
            0,
            CHAIN_TILE_W / 2,
            CHAIN_TILE_H,
          );
          cx += CHAIN_TILE_W + CHAIN_GAP;
        });
        for (let i = current.chain.length; i < chainPool.length; i++) {
          chainPool[i].container.visible = false;
        }

        const hand = current.hand ?? [];
        const handWidth = hand.length * (TILE_W + HAND_GAP) - HAND_GAP;
        let hx = (CANVAS_WIDTH - handWidth) / 2;
        const hy = 220;
        const isMyTurn =
          current.currentPlayer === selfIdRef.current &&
          roleRef.current !== 'spectator' &&
          roleRef.current !== 'queued';
        hand.forEach((tile, index) => {
          const entry = getHandEntry(index);
          entry.tile = tile;
          const ends = legalEndsFor(tile, current.leftEnd, current.rightEnd);
          const playable = current.chain.length === 0 || ends.length > 0;
          const isSelected =
            selectedTileRef.current !== null &&
            tileMatches(selectedTileRef.current, tile);
          const fill = isSelected
            ? TILE_SELECTED_COLOR
            : isMyTurn && playable
              ? TILE_COLOR
              : TILE_DISABLED_COLOR;
          drawTileFace(entry.gfx, TILE_W, TILE_H, fill);
          drawPips(entry.gfx, tile.a, 0, 0, TILE_W, TILE_H / 2);
          drawPips(entry.gfx, tile.b, 0, TILE_H / 2, TILE_W, TILE_H / 2);

          entry.container.visible = true;
          entry.container.position.set(hx, hy);
          const interactive = isMyTurn && playable;
          entry.container.eventMode = interactive ? 'static' : 'none';
          entry.container.cursor = interactive ? 'pointer' : 'default';
          hx += TILE_W + HAND_GAP;
        });
        for (let i = hand.length; i < handPool.length; i++) {
          handPool[i].container.visible = false;
          handPool[i].tile = null;
        }
      }

      render();
      renderRef.current = render;
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
      renderRef.current = null;
      appRef.current = null;
      if (initialized) {
        app.destroy({ removeView: false });
      }
    };
  }, []);

  useEffect(() => {
    renderRef.current?.();
  }, [state, selectedTile, role]);

  return <canvas ref={canvasRef} className="block" />;
}
