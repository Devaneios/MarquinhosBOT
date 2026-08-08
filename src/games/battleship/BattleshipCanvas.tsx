import { Application, Container, Graphics } from 'pixi.js';
import { useEffect, useRef } from 'react';
import {
  BOARD_SIZE,
  SHIP_SIZES,
  type BoardView,
  type Orientation,
  type ShipType,
} from './types';

const CELL = 30;
const BOARD_PX = CELL * BOARD_SIZE;
const GAP = 24;

const WATER = '#0e2a3d';
const WATER_LINE = '#1c4a63';
const SHIP_COLOR = '#5fbf77';
const SHIP_SUNK_COLOR = '#c0455a';
const MISS_COLOR = '#5c6773';
const HIT_COLOR = '#ff6b4a';
const PREVIEW_OK = 'rgba(95,191,119,0.55)';
const PREVIEW_BAD = 'rgba(224,80,80,0.55)';

export interface PendingShip {
  type: ShipType;
  x: number;
  y: number;
  orientation: Orientation;
}

export interface BattleshipCanvasProps {
  mode: 'placement' | 'battle';
  ownBoard: BoardView;
  opponentBoard?: BoardView;
  pendingShips?: PendingShip[];
  previewCells?: { x: number; y: number }[];
  previewValid?: boolean;
  canFire?: boolean;
  onHoverOwnCell?: (cell: { x: number; y: number } | null) => void;
  onClickOwnCell?: (cell: { x: number; y: number }) => void;
  onClickOpponentCell?: (cell: { x: number; y: number }) => void;
}

function drawGrid(g: Graphics) {
  g.clear();
  g.rect(0, 0, BOARD_PX, BOARD_PX).fill(WATER);
  for (let i = 0; i <= BOARD_SIZE; i++) {
    g.moveTo(i * CELL, 0).lineTo(i * CELL, BOARD_PX);
    g.moveTo(0, i * CELL).lineTo(BOARD_PX, i * CELL);
  }
  g.stroke({ width: 1, color: WATER_LINE });
}

function cellFromLocal(x: number, y: number): { x: number; y: number } | null {
  const gx = Math.floor(x / CELL);
  const gy = Math.floor(y / CELL);
  if (gx < 0 || gx >= BOARD_SIZE || gy < 0 || gy >= BOARD_SIZE) return null;
  return { x: gx, y: gy };
}

// Single reusable grid painter shared by the placement board and both
// battle boards — everything it draws is derived purely from its args, so
// mode-specific behavior (hover preview vs. fire clicks) lives entirely in
// the callbacks the caller wires up, not in this function.
function paintBoard(
  ships: Container,
  shots: Container,
  board: BoardView,
  showShips: boolean,
) {
  ships.removeChildren();
  shots.removeChildren();

  if (showShips) {
    for (const ship of board.ships) {
      for (const cell of ship.cells) {
        const g = new Graphics()
          .rect(2, 2, CELL - 4, CELL - 4)
          .fill(ship.sunk ? SHIP_SUNK_COLOR : SHIP_COLOR);
        g.position.set(cell.x * CELL, cell.y * CELL);
        ships.addChild(g);
      }
    }
  }

  for (const shot of board.shots) {
    const g = new Graphics();
    if (shot.hit) {
      g.circle(CELL / 2, CELL / 2, CELL * 0.28).fill(
        shot.sunk ? SHIP_SUNK_COLOR : HIT_COLOR,
      );
    } else {
      g.circle(CELL / 2, CELL / 2, CELL * 0.12).fill(MISS_COLOR);
    }
    g.position.set(shot.x * CELL, shot.y * CELL);
    shots.addChild(g);
  }
}

function paintPending(layer: Container, pendingShips: PendingShip[]) {
  layer.removeChildren();
  for (const ship of pendingShips) {
    const size = SHIP_SIZES[ship.type];
    for (let i = 0; i < size; i++) {
      const cx = ship.orientation === 'horizontal' ? ship.x + i : ship.x;
      const cy = ship.orientation === 'horizontal' ? ship.y : ship.y + i;
      const g = new Graphics()
        .rect(2, 2, CELL - 4, CELL - 4)
        .fill(SHIP_COLOR);
      g.position.set(cx * CELL, cy * CELL);
      layer.addChild(g);
    }
  }
}

function paintPreview(
  layer: Container,
  cells: { x: number; y: number }[],
  valid: boolean,
) {
  layer.removeChildren();
  for (const cell of cells) {
    const g = new Graphics()
      .rect(1, 1, CELL - 2, CELL - 2)
      .fill(valid ? PREVIEW_OK : PREVIEW_BAD);
    g.position.set(cell.x * CELL, cell.y * CELL);
    layer.addChild(g);
  }
}

// Renders one or two 10x10 boards with PixiJS. Follows PongCanvas's
// lifecycle pattern: a single effect owns Application creation, the
// StrictMode-safe deferred init, and full teardown (ticker, listeners,
// Application.destroy) on unmount.
export function BattleshipCanvas(props: BattleshipCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<Application | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => {
    let cancelled = false;
    let initialized = false;
    const app = new Application();
    appRef.current = app;

    const width =
      props.mode === 'battle' ? BOARD_PX * 2 + GAP : BOARD_PX;
    const height = BOARD_PX;

    let ownGrid: Graphics;
    let ownShips: Container;
    let ownShots: Container;
    let ownPreview: Container;
    let ownPending: Container;
    let ownHitBox: Graphics;
    let opponentGrid: Graphics | null = null;
    let opponentShips: Container | null = null;
    let opponentShots: Container | null = null;
    let opponentHitBox: Graphics | null = null;
    let opponentRoot: Container | null = null;

    function render() {
      const current = propsRef.current;
      drawGrid(ownGrid);
      paintBoard(ownShips, ownShots, current.ownBoard, true);
      paintPreview(
        ownPreview,
        current.previewCells ?? [],
        current.previewValid ?? false,
      );
      paintPending(ownPending, current.pendingShips ?? []);

      if (current.mode === 'battle' && opponentGrid && opponentShips) {
        drawGrid(opponentGrid);
        paintBoard(
          opponentShips,
          opponentShots!,
          current.opponentBoard ?? { ships: [], shots: [] },
          false,
        );
      }
    }

    (async () => {
      await Promise.resolve();
      if (cancelled) return;

      await app.init({
        canvas: canvasRef.current!,
        width,
        height,
        background: '#08161f',
        antialias: true,
        resolution: window.devicePixelRatio,
        autoDensity: true,
      });
      if (cancelled) {
        app.destroy({ removeView: false });
        return;
      }
      initialized = true;

      ownGrid = new Graphics();
      ownShips = new Container();
      ownShots = new Container();
      ownPreview = new Container();
      ownPending = new Container();
      const ownRoot = new Container();
      ownRoot.addChild(ownGrid, ownShips, ownPreview, ownPending, ownShots);
      app.stage.addChild(ownRoot);

      ownHitBox = new Graphics()
        .rect(0, 0, BOARD_PX, BOARD_PX)
        .fill({ color: 0x000000, alpha: 0.001 });
      ownHitBox.eventMode = 'static';
      ownHitBox.cursor = 'pointer';
      ownHitBox.on('pointermove', (e) => {
        const local = e.getLocalPosition(ownHitBox);
        propsRef.current.onHoverOwnCell?.(cellFromLocal(local.x, local.y));
      });
      ownHitBox.on('pointerout', () => {
        propsRef.current.onHoverOwnCell?.(null);
      });
      ownHitBox.on('pointertap', (e) => {
        const local = e.getLocalPosition(ownHitBox);
        const cell = cellFromLocal(local.x, local.y);
        if (cell) propsRef.current.onClickOwnCell?.(cell);
      });
      ownRoot.addChild(ownHitBox);

      if (props.mode === 'battle') {
        opponentGrid = new Graphics();
        opponentShips = new Container();
        opponentShots = new Container();
        opponentRoot = new Container();
        opponentRoot.position.set(BOARD_PX + GAP, 0);
        opponentRoot.addChild(opponentGrid, opponentShips, opponentShots);
        app.stage.addChild(opponentRoot);

        opponentHitBox = new Graphics()
          .rect(0, 0, BOARD_PX, BOARD_PX)
          .fill({ color: 0x000000, alpha: 0.001 });
        opponentHitBox.eventMode = 'static';
        opponentHitBox.cursor = 'pointer';
        opponentHitBox.on('pointertap', (e) => {
          if (!propsRef.current.canFire) return;
          const local = e.getLocalPosition(opponentHitBox!);
          const cell = cellFromLocal(local.x, local.y);
          if (cell) propsRef.current.onClickOpponentCell?.(cell);
        });
        opponentRoot.addChild(opponentHitBox);
      }

      render();
      app.ticker.add(render);
    })();

    return () => {
      cancelled = true;
      if (initialized) {
        app.ticker.remove(render);
        app.destroy({ removeView: false });
      }
      appRef.current = null;
    };
    // Board/props updates are read live via propsRef inside the ticker's
    // render() rather than re-running this effect, exactly like PongCanvas
    // reads configRef — re-running would tear down and reinit the whole
    // WebGL context on every state message.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.mode]);

  return <canvas ref={canvasRef} />;
}
