import type {
  BoardView,
  ShipPlacement,
} from '@marquinhos/contracts/activity/games/battleship';
import { Application } from 'pixi.js';
import { useEffect, useEffectEvent, useRef } from 'react';
import {
  BattleshipScene,
  boardCountFor,
  computeLayout,
  type ActiveBoard,
  type BoardInput,
  type BoardSlot,
  type CanvasMode,
  type Cell,
  type MotionPreference,
  type SceneInput,
} from './battleshipScene';

const EMPTY_BOARD: BoardView = { ships: [], shots: [] };

export interface BattleshipCanvasProps {
  mode: CanvasMode;
  ownBoard: BoardView;
  opponentBoard?: BoardView;
  ownTitle?: string;
  opponentTitle?: string;
  activeBoard?: ActiveBoard;
  pendingShips?: ShipPlacement[];
  previewCells?: Cell[];
  previewValid?: boolean;
  canFire?: boolean;
  className?: string;
  onHoverOwnCell?: (cell: Cell | null) => void;
  onClickOwnCell?: (cell: Cell) => void;
  onClickOpponentCell?: (cell: Cell) => void;
}

function slotsFor(mode: CanvasMode): BoardSlot[] {
  return mode === 'battle' ? ['own', 'opponent'] : ['own'];
}

function sceneInputFor(props: BattleshipCanvasProps): SceneInput {
  const active = props.activeBoard ?? 'none';
  const own: BoardInput = {
    board: props.ownBoard,
    title: props.ownTitle ?? '',
    active: active === 'own',
    pendingShips: props.pendingShips ?? [],
    previewCells: props.previewCells ?? [],
    previewValid: props.previewValid ?? false,
    canFire: false,
  };
  if (props.mode !== 'battle') return { mode: props.mode, boards: { own } };
  const opponent: BoardInput = {
    board: props.opponentBoard ?? EMPTY_BOARD,
    title: props.opponentTitle ?? '',
    active: active === 'opponent',
    pendingShips: [],
    previewCells: [],
    previewValid: false,
    canFire: props.canFire ?? false,
  };
  return { mode: props.mode, boards: { own, opponent } };
}

function motionPreference(): MotionPreference {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ? 'reduced'
    : 'full';
}

// Pixi lifecycle only; all drawing lives in battleshipScene.ts. The
// Application is created once and survives mode and size changes — the
// scene relayouts in place, since re-initializing would recreate the WebGL
// context on every phase change.
export function BattleshipCanvas(props: BattleshipCanvasProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const getProps = useEffectEvent(() => props);
  const syncRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let cancelled = false;
    let initialized = false;
    const app = new Application();
    let scene: BattleshipScene | null = null;
    let observer: ResizeObserver | null = null;
    let onContextLost: ((event: Event) => void) | null = null;
    let onContextRestored: (() => void) | null = null;
    let contextCanvas: HTMLCanvasElement | null = null;

    function onVisibilityChange() {
      if (!initialized) return;
      if (document.hidden) app.ticker.stop();
      else app.ticker.start();
    }
    document.addEventListener('visibilitychange', onVisibilityChange);

    function sync() {
      if (!scene || !wrapperRef.current) return;
      const current = getProps();
      const slots = slotsFor(current.mode);
      const layout = computeLayout(
        wrapperRef.current.clientWidth,
        boardCountFor(current.mode),
      );
      if (!scene.hasLayout(layout, slots)) {
        app.renderer.resize(layout.width, layout.height);
        scene.setLayout(layout, slots);
      }
      scene.update(sceneInputFor(current), performance.now());
    }

    function tick() {
      scene?.tick(performance.now());
    }

    (async () => {
      await Promise.resolve();
      if (cancelled) return;

      await app.init({
        canvas: canvasRef.current!,
        width: 1,
        height: 1,
        backgroundAlpha: 0,
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

      scene = new BattleshipScene(
        app.stage,
        {
          own: {
            onHover: (cell) => getProps().onHoverOwnCell?.(cell),
            onTap: (cell) => getProps().onClickOwnCell?.(cell),
          },
          opponent: {
            onTap: (cell) => {
              if (!getProps().canFire) return;
              getProps().onClickOpponentCell?.(cell);
            },
          },
        },
        motionPreference(),
      );
      syncRef.current = sync;
      sync();

      observer = new ResizeObserver(() => sync());
      observer.observe(wrapperRef.current!);
      app.ticker.add(tick);
    })();

    return () => {
      cancelled = true;
      syncRef.current = null;
      observer?.disconnect();
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
        app.ticker.remove(tick);
        app.destroy({ removeView: false }, { children: true });
      }
    };
  }, []);

  // Board state arrives through React renders; push it into the scene after
  // each one rather than polling props every frame.
  useEffect(() => {
    syncRef.current?.();
  });

  return (
    <div ref={wrapperRef} className={props.className ?? 'w-full'}>
      <canvas ref={canvasRef} className="mx-auto block touch-manipulation" />
    </div>
  );
}
