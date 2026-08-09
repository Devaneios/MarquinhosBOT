import type { Room } from '@colyseus/sdk';
import { Application, Graphics } from 'pixi.js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { colyseusUrl } from '../../lib/apiBase';
import { devinfo, devlog, devwarn } from '../../lib/devlog';
import type { WsSession } from '../shared/activitySession';
import {
  useColyseusRoom,
  type ActivityMessage,
} from '../shared/useColyseusRoom';
import type {
  SnakeDirection,
  SnakeGameState,
  SnakePublicConfig,
  SnakeSegment,
} from './types';
import type { SnakeMode } from './useSnakeSession';

const CELL_SIZE = 20;
const BG_COLOR = '#000000';
const GRID_COLOR = '#222222';
const SNAKE_COLORS: Record<string, number> = {
  player1: 0x00ff00,
  player2: 0xffff00,
};
const FALLBACK_SNAKE_COLOR = 0x888888;
const FOOD_COLOR = '#ff0000';
// Server ticks (and broadcasts state) at ~150ms (FIXED_DT_MS in
// SnakeSession); a slightly shorter interpolation window keeps the render
// from visibly lagging behind fresh input on direction changes.
const INTERP_MS = 120;
// A segment moving more than one cell between snapshots is a wrap-around
// (or a respawn), not continuous motion — lerping that would draw a snake
// sliding diagonally across the whole board, so snap instead.
const MAX_LERP_CELLS = 1;

const DEFAULT_CONFIG: SnakePublicConfig = {
  width: 20,
  height: 20,
  initialSnakeLength: 3,
  winningScore: 10,
};

const KEY_TO_DIRECTION: Record<string, SnakeDirection> = {
  arrowup: 'up',
  w: 'up',
  arrowdown: 'down',
  s: 'down',
  arrowleft: 'left',
  a: 'left',
  arrowright: 'right',
  d: 'right',
};

function drawGrid(gfx: Graphics, config: SnakePublicConfig) {
  gfx.clear();
  for (let x = 0; x <= config.width; x++) {
    gfx
      .moveTo(x * CELL_SIZE, 0)
      .lineTo(x * CELL_SIZE, config.height * CELL_SIZE);
  }
  for (let y = 0; y <= config.height; y++) {
    gfx
      .moveTo(0, y * CELL_SIZE)
      .lineTo(config.width * CELL_SIZE, y * CELL_SIZE);
  }
  gfx.stroke({ width: 1, color: GRID_COLOR });
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function lerpSegment(
  prev: SnakeSegment,
  latest: SnakeSegment,
  t: number,
): SnakeSegment {
  if (
    Math.abs(latest.x - prev.x) > MAX_LERP_CELLS ||
    Math.abs(latest.y - prev.y) > MAX_LERP_CELLS
  ) {
    return latest;
  }
  return { x: lerp(prev.x, latest.x, t), y: lerp(prev.y, latest.y, t) };
}

function drawEntities(
  gfx: Graphics,
  state: SnakeGameState,
  prevState: SnakeGameState | null,
  t: number,
) {
  gfx.clear();
  for (const [id, snake] of Object.entries(state.snakes)) {
    const color = SNAKE_COLORS[id] ?? FALLBACK_SNAKE_COLOR;
    const prevSnake = prevState?.snakes[id];
    for (let i = 0; i < snake.segments.length; i++) {
      const segment = snake.segments[i];
      const prevSegment = prevSnake?.segments[i];
      const { x, y } = prevSegment
        ? lerpSegment(prevSegment, segment, t)
        : segment;
      gfx
        .rect(
          x * CELL_SIZE + 1,
          y * CELL_SIZE + 1,
          CELL_SIZE - 2,
          CELL_SIZE - 2,
        )
        .fill(color);
    }
  }
  for (const food of state.food) {
    gfx
      .rect(
        food.x * CELL_SIZE + 5,
        food.y * CELL_SIZE + 5,
        CELL_SIZE - 10,
        CELL_SIZE - 10,
      )
      .fill(FOOD_COLOR);
  }
}

export function SnakeCanvas({
  session,
  mode,
  onMainMenu,
}: {
  session: WsSession;
  mode: SnakeMode;
  onMainMenu: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<Application | null>(null);
  const configRef = useRef<SnakePublicConfig>(DEFAULT_CONFIG);
  const latestStateRef = useRef<{
    state: SnakeGameState;
    receivedAt: number;
  } | null>(null);
  const prevStateRef = useRef<{
    state: SnakeGameState;
    receivedAt: number;
  } | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, number> | null>(null);
  const [winner, setWinner] = useState<string | null>(null);
  const [pausedOpponent, setPausedOpponent] = useState<{
    playerId: string;
    timeoutMs: number;
  } | null>(null);
  const messageHandlerRef = useRef<(message: ActivityMessage) => void>(
    () => {},
  );

  // Sending 'leave' before the room disconnects (rather than a bare close)
  // tells the server this is an intentional quit rather than a network drop.
  const sendLeaveOnDisconnect = useCallback((room: Room) => {
    room.send('leave');
  }, []);

  const { send: roomSend, connectionState } = useColyseusRoom(
    'snake-game',
    session,
    colyseusUrl(),
    (message) => messageHandlerRef.current(message),
    sendLeaveOnDisconnect,
  );

  // eslint-disable react-hooks/exhaustive-deps -- intentional [session]-only
  // deps per §6.2; mode/roomSend are fixed for the session's lifetime and
  // MUST NOT retrigger this effect.
  useEffect(() => {
    devlog('[snake-canvas] mounting');
    configRef.current = DEFAULT_CONFIG;
    latestStateRef.current = null;
    prevStateRef.current = null;
    setPlayerId(null);
    setScores(null);
    setWinner(null);
    setPausedOpponent(null);

    let cancelled = false;
    let initialized = false;
    let gridGfx: Graphics;
    let entitiesGfx: Graphics;
    let lastConfig: SnakePublicConfig = DEFAULT_CONFIG;

    function applyConfigChange(config: SnakePublicConfig) {
      lastConfig = config;
      app.renderer.resize(config.width * CELL_SIZE, config.height * CELL_SIZE);
      drawGrid(gridGfx, config);
    }

    messageHandlerRef.current = (message) => {
      if (message.type === 'init') {
        const payload = message.payload as {
          playerId: string | null;
          config?: SnakePublicConfig;
        };
        devlog('[snake-canvas] assigned player id', payload.playerId);
        setPlayerId(payload.playerId);
        if (payload.config) {
          configRef.current = payload.config;
        }
      } else if (message.type === 'state') {
        const payload = message.payload as { state: SnakeGameState };
        const state = payload.state;
        prevStateRef.current = latestStateRef.current;
        latestStateRef.current = { state, receivedAt: performance.now() };
        setScores(state.scores);
        setWinner(state.winner);
      } else if (message.type === 'opponent_disconnected') {
        devwarn('[snake-canvas] opponent disconnected', message.payload);
        setPausedOpponent(
          message.payload as { playerId: string; timeoutMs: number },
        );
      } else if (message.type === 'opponent_reconnected') {
        devinfo('[snake-canvas] opponent reconnected');
        setPausedOpponent(null);
      }
    };

    const heldKeys = new Set<string>();
    let lastSentDirection: SnakeDirection | null = null;

    function onKeyDown(event: KeyboardEvent) {
      const key = event.key.toLowerCase();
      const direction = KEY_TO_DIRECTION[key];
      if (!direction) return;
      event.preventDefault();
      if (heldKeys.has(key)) return;
      heldKeys.add(key);
      if (direction !== lastSentDirection) {
        lastSentDirection = direction;
        roomSend({ type: 'input', payload: { direction } });
      }
    }
    function onKeyUp(event: KeyboardEvent) {
      heldKeys.delete(event.key.toLowerCase());
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    function onVisibilityChange() {
      if (!initialized) return;
      if (document.hidden) {
        appRef.current?.ticker.stop();
      } else {
        prevStateRef.current = null;
        appRef.current?.ticker.start();
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange);

    let onContextLost: ((event: Event) => void) | null = null;
    let onContextRestored: (() => void) | null = null;
    let contextCanvas: HTMLCanvasElement | null = null;
    let tick: (() => void) | null = null;

    const app = new Application();
    appRef.current = app;

    (async () => {
      // Yield a microtask before touching the canvas. React 19 StrictMode
      // double-invokes this effect synchronously (mount, cleanup, mount)
      // before any promise settles. Checking `cancelled` after the
      // microtask tick lets the phantom first invocation bail out here,
      // before it ever calls init(), so only the real instance touches the
      // canvas.
      await Promise.resolve();
      if (cancelled) return;

      await app.init({
        canvas: canvasRef.current!,
        width: configRef.current.width * CELL_SIZE,
        height: configRef.current.height * CELL_SIZE,
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

      gridGfx = new Graphics();
      entitiesGfx = new Graphics();
      lastConfig = configRef.current;
      drawGrid(gridGfx, configRef.current);
      app.stage.addChild(gridGfx, entitiesGfx);

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

      tick = () => {
        const config = configRef.current;
        if (config !== lastConfig) applyConfigChange(config);

        const latest = latestStateRef.current;
        if (!latest) return;

        const prev = prevStateRef.current;
        const now = performance.now();
        const t = clamp((now - latest.receivedAt) / INTERP_MS, 0, 1);
        drawEntities(entitiesGfx, latest.state, prev?.state ?? null, t);
      };
      app.ticker.add(tick);
    })();

    return () => {
      devlog('[snake-canvas] unmounting, leaving session');
      cancelled = true;
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
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
      // The room's own leave is handled by useColyseusRoom's cleanup.
      messageHandlerRef.current = () => {};
      if (initialized) {
        if (tick) app.ticker.remove(tick);
        app.destroy({ removeView: false });
      }
      appRef.current = null;
    };
  }, [session]);
  // eslint-enable react-hooks/exhaustive-deps

  const p1Score = scores?.player1 ?? 0;
  const p2Score = mode === 'single' ? undefined : scores?.player2;
  const p2Name = 'Player 2';
  const winnerLabel =
    winner === playerId
      ? 'YOU WIN'
      : winner
        ? `${winner === 'player2' ? p2Name : winner} WINS`
        : '';

  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden">
      <canvas ref={canvasRef} className="block max-h-full max-w-full" />
      <div className="absolute top-3 left-3 font-mono text-sm text-marquinhos-green">
        <div>Player 1: {p1Score}</div>
        {p2Score !== undefined && (
          <div>
            {p2Name}: {p2Score}
          </div>
        )}
      </div>
      <button
        type="button"
        className="font-pixel absolute bottom-3 left-3 cursor-pointer border border-marquinhos-border bg-marquinhos-panel px-3.5 py-2 text-[11px] text-marquinhos-text hover:border-marquinhos-border-hover"
        onClick={onMainMenu}
      >
        LEAVE GAME
      </button>
      {(connectionState === 'disconnected' || connectionState === 'error') && (
        <div className="font-pixel absolute top-3 left-1/2 -translate-x-1/2 border border-marquinhos-danger/60 bg-marquinhos-panel px-3 py-1.5 text-[11px] tracking-wide text-marquinhos-danger">
          CONNECTION LOST — RELOAD TO RECONNECT
        </div>
      )}
      {pausedOpponent && !winner && (
        <div className="font-pixel absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-sm text-marquinhos-text">
          OPPONENT DISCONNECTED — WAITING…
        </div>
      )}
      {winner && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-marquinhos-bg/90">
          <div className="font-pixel text-center text-3xl text-marquinhos-text">
            {winnerLabel}
          </div>
          <button
            type="button"
            className="notch-6 cursor-pointer border border-marquinhos-border bg-marquinhos-panel px-6 py-4.5 font-mono text-xs tracking-wide text-marquinhos-text hover:border-marquinhos-border-hover"
            onClick={onMainMenu}
          >
            MAIN MENU
          </button>
        </div>
      )}
    </div>
  );
}
