import { Application, Graphics } from 'pixi.js';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { devinfo, devlog, devwarn } from '../../../lib/devlog';
import { useRoomConnectionContext } from '../../shared/RoomConnectionProvider';
import type { SnakeDirection, SnakeGameState, SnakePublicConfig } from '../types';
import {
  BG_COLOR,
  CELL_SIZE,
  clamp,
  DEFAULT_CONFIG,
  drawEntities,
  drawGrid,
  INTERP_MS,
  KEY_TO_DIRECTION,
} from './SnakeCanvas';

// Renders Snake inside a multiplayer Room view — driven by
// RoomConnectionContext instead of SnakeCanvas's own useColyseusRoom call.
// Reuses SnakeCanvas's exported pure rendering helpers (drawGrid,
// drawEntities, interpolation math) rather than duplicating them; the game
// loop / keyboard-input wiring is reimplemented here against
// ctx.subscribe/ctx.send, gated on `ctx.role` — unlike every other room
// board's redundant-but-consistent gate, this one is load-bearing: the
// standalone SnakeCanvas's keydown handler sends 'input' unconditionally,
// with no check that the local viewer is even a registered player.
export function SnakeRoomBoard() {
  const ctx = useRoomConnectionContext();
  const { t } = useTranslation(['snake-game', 'common']);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<Application | null>(null);
  const configRef = useRef<SnakePublicConfig>(DEFAULT_CONFIG);
  const latestStateRef = useRef<{ state: SnakeGameState; receivedAt: number } | null>(null);
  const prevStateRef = useRef<{ state: SnakeGameState; receivedAt: number } | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, number> | null>(null);
  const [winner, setWinner] = useState<string | null>(null);
  const [pausedOpponent, setPausedOpponent] = useState<{
    playerId: string;
    timeoutMs: number;
  } | null>(null);
  const roleRef = useRef(ctx?.role ?? null);
  roleRef.current = ctx?.role ?? null;
  const sendRef = useRef(ctx?.send);
  sendRef.current = ctx?.send;

  useEffect(() => {
    if (!ctx) return;
    return ctx.subscribe((message) => {
      if (message.type === 'init') {
        const payload = message.payload as { playerId: string | null; config?: SnakePublicConfig };
        devlog('[snake-room] assigned player id', payload.playerId);
        setPlayerId(payload.playerId);
        if (payload.config) configRef.current = payload.config;
      } else if (message.type === 'state') {
        const payload = message.payload as { state: SnakeGameState };
        prevStateRef.current = latestStateRef.current;
        latestStateRef.current = { state: payload.state, receivedAt: performance.now() };
        setScores(payload.state.scores);
        setWinner(payload.state.winner);
      } else if (message.type === 'opponent_disconnected') {
        devwarn('[snake-room] opponent disconnected', message.payload);
        setPausedOpponent(message.payload as { playerId: string; timeoutMs: number });
      } else if (message.type === 'opponent_reconnected') {
        devinfo('[snake-room] opponent reconnected');
        setPausedOpponent(null);
      }
    });
  }, [ctx]);

  useEffect(() => {
    devlog('[snake-room] mounting');
    configRef.current = DEFAULT_CONFIG;
    latestStateRef.current = null;
    prevStateRef.current = null;

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

    const heldKeys = new Set<string>();
    let lastSentDirection: SnakeDirection | null = null;

    function onKeyDown(event: KeyboardEvent) {
      const key = event.key.toLowerCase();
      const direction = KEY_TO_DIRECTION[key];
      if (!direction) return;
      event.preventDefault();
      if (heldKeys.has(key)) return;
      heldKeys.add(key);
      if (roleRef.current === 'spectator' || roleRef.current === 'queued') return;
      if (direction !== lastSentDirection) {
        lastSentDirection = direction;
        sendRef.current?.({ type: 'input', payload: { direction } });
      }
    }
    function onKeyUp(event: KeyboardEvent) {
      heldKeys.delete(event.key.toLowerCase());
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    function onVisibilityChange() {
      if (!initialized) return;
      if (document.hidden) appRef.current?.ticker.stop();
      else {
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
      contextCanvas.addEventListener('webglcontextrestored', onContextRestored, false);

      tick = () => {
        const config = configRef.current;
        if (config !== lastConfig) applyConfigChange(config);

        const latest = latestStateRef.current;
        if (!latest) return;

        const prev = prevStateRef.current;
        const now = performance.now();
        const tRatio = clamp((now - latest.receivedAt) / INTERP_MS, 0, 1);
        drawEntities(entitiesGfx, latest.state, prev?.state ?? null, tRatio);
      };
      app.ticker.add(tick);
    })();

    return () => {
      devlog('[snake-room] unmounting');
      cancelled = true;
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (contextCanvas && onContextLost) {
        contextCanvas.removeEventListener('webglcontextlost', onContextLost);
      }
      if (contextCanvas && onContextRestored) {
        contextCanvas.removeEventListener('webglcontextrestored', onContextRestored);
      }
      if (initialized) {
        if (tick) app.ticker.remove(tick);
        app.destroy({ removeView: false });
      }
      appRef.current = null;
    };
  }, []);

  const p1Label = t('snake-game:player1');
  const p2Label = t('snake-game:player2');
  const p1Score = scores?.player1 ?? 0;
  const p2Score = scores?.player2;
  const winnerLabel =
    winner === playerId
      ? t('snake-game:youWin')
      : winner
        ? t('snake-game:playerWins', { name: winner === 'player2' ? p2Label : p1Label })
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
      {ctx?.connectionState === 'disconnected' || ctx?.connectionState === 'error' ? (
        <div className="font-pixel absolute top-3 left-1/2 -translate-x-1/2 border border-marquinhos-danger/60 bg-marquinhos-panel px-3 py-1.5 text-[11px] tracking-wide text-marquinhos-danger">
          {t('common:connectionLost')}
        </div>
      ) : null}
      {pausedOpponent && !winner && (
        <div className="font-pixel absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-sm text-marquinhos-text">
          {t('snake-game:opponentDisconnected')}
        </div>
      )}
      {winner && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-marquinhos-bg/90">
          <div className="font-pixel text-center text-3xl text-marquinhos-text">{winnerLabel}</div>
        </div>
      )}
    </div>
  );
}
