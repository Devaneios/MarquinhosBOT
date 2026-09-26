import type { WsSession } from '@/games/shared/session/gameSession';
import {
  backChipClass,
  menuButtonSecondary,
} from '@/games/shared/shell/menu/menuButtons';
import { colyseusUrl } from '@/platform/api/apiBase';
import type { ActivityMessage } from '@/platform/realtime/colyseus/connection';
import { useColyseusRoom } from '@/platform/realtime/colyseus/useColyseusRoom';
import { devlog } from '@/shared/logging/devlog';
import { cn } from '@/shared/utils/cn';
import type { Room } from '@colyseus/sdk';
import {
  serverMessageSchema,
  type SnakeClientMessage,
  type SnakeDirection,
  type SnakePublicConfig,
} from '@marquinhos/contracts/activity/games/snakeGame';
import { parseMessage } from '@marquinhos/contracts/activity/protocol';
import { Application, Graphics } from 'pixi.js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BG_COLOR,
  CELL_SIZE,
  clamp,
  drawEntities,
  drawGrid,
  INTERP_MS,
  KEY_TO_DIRECTION,
} from '../rendering/snakeRendering';
import { applySnakeMessage, initialSnakeView } from '../session/snakeMessages';
import type { SnakeMode } from '../session/useSnakeSession';

export function SnakeBoard({
  session,
  mode,
  onMainMenu,
}: {
  session: WsSession;
  mode: SnakeMode;
  onMainMenu: () => void;
}) {
  const { t } = useTranslation(['snake-game', 'common']);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<Application | null>(null);
  const viewRef = useRef(initialSnakeView);
  const [view, setView] = useState(initialSnakeView);
  const { playerId, pausedOpponent } = view;
  const scores = view.latest?.state.scores ?? null;
  const winner = view.latest?.state.winner ?? null;

  // Sending 'leave' before the room disconnects (rather than a bare close)
  // tells the server this is an intentional quit rather than a network drop.
  const sendLeaveOnDisconnect = useCallback((room: Room) => {
    room.send('leave');
  }, []);

  const { send: roomSend, connectionState } = useColyseusRoom(
    'snake-game',
    session,
    colyseusUrl(),
    (raw: ActivityMessage) => {
      const message = parseMessage(serverMessageSchema, raw);
      if (!message) return;
      if (message.type !== 'state')
        devlog('[snake-canvas]', message.type, message.payload);
      viewRef.current = applySnakeMessage(
        viewRef.current,
        message,
        performance.now(),
      );
      setView(viewRef.current);
    },
    sendLeaveOnDisconnect,
  );

  // eslint-disable react-hooks/exhaustive-deps -- intentional [session]-only
  // deps per §6.2; mode/roomSend are fixed for the session's lifetime and
  // MUST NOT retrigger this effect.
  useEffect(() => {
    devlog('[snake-canvas] mounting');
    viewRef.current = initialSnakeView;
    setView(initialSnakeView);

    let cancelled = false;
    let initialized = false;
    let gridGfx: Graphics;
    let entitiesGfx: Graphics;
    let lastConfig = initialSnakeView.config;

    function applyConfigChange(config: SnakePublicConfig) {
      lastConfig = config;
      app.renderer.resize(config.width * CELL_SIZE, config.height * CELL_SIZE);
      drawGrid(gridGfx, config);
    }

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
        roomSend({
          type: 'input',
          payload: { direction },
        } satisfies SnakeClientMessage);
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
        viewRef.current = { ...viewRef.current, prev: null };
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
        width: viewRef.current.config.width * CELL_SIZE,
        height: viewRef.current.config.height * CELL_SIZE,
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
      lastConfig = viewRef.current.config;
      drawGrid(gridGfx, viewRef.current.config);
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
        const config = viewRef.current.config;
        if (config !== lastConfig) applyConfigChange(config);

        const latest = viewRef.current.latest;
        if (!latest) return;

        const prev = viewRef.current.prev;
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
      if (initialized) {
        if (tick) app.ticker.remove(tick);
        app.destroy({ removeView: false });
      }
      appRef.current = null;
    };
  }, [session]);
  // eslint-enable react-hooks/exhaustive-deps

  const p1Label = t('snake-game:player1');
  const p2Label = t('snake-game:player2');
  const p1Score = scores?.player1 ?? 0;
  const p2Score = mode === 'single' ? undefined : scores?.player2;
  const winnerLabel =
    winner === playerId
      ? t('snake-game:youWin')
      : winner
        ? t('snake-game:playerWins', {
            name: winner === 'player2' ? p2Label : p1Label,
          })
        : '';

  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden">
      <canvas ref={canvasRef} className="block max-h-full max-w-full" />
      <div className="absolute top-3 left-3 font-mono text-sm text-marquinhos-green">
        <div>
          {p1Label}: {p1Score}
        </div>
        {p2Score !== undefined && (
          <div>
            {p2Label}: {p2Score}
          </div>
        )}
      </div>
      <button
        type="button"
        className={cn(backChipClass, 'absolute bottom-3 left-3')}
        onClick={onMainMenu}
      >
        {t('snake-game:leaveGame')}
      </button>
      {(connectionState === 'disconnected' || connectionState === 'error') && (
        <div className="font-pixel absolute top-3 left-1/2 -translate-x-1/2 border border-marquinhos-danger/60 bg-marquinhos-panel px-3 py-1.5 text-[11px] tracking-wide text-marquinhos-danger">
          {t('common:connectionLost')}
        </div>
      )}
      {pausedOpponent && !winner && (
        <div className="font-pixel absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-sm text-marquinhos-text">
          {t('snake-game:opponentDisconnected')}
        </div>
      )}
      {winner && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-marquinhos-bg/90">
          <div className="font-pixel text-center text-3xl text-marquinhos-text">
            {winnerLabel}
          </div>
          <button
            type="button"
            className={menuButtonSecondary}
            onClick={onMainMenu}
          >
            {t('common:mainMenu')}
          </button>
        </div>
      )}
    </div>
  );
}
