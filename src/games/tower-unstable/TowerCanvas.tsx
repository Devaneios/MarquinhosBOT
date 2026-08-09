import { Application, Graphics } from 'pixi.js';
import { useEffect, useRef, useState } from 'react';
import { colyseusUrl } from '../../lib/apiBase';
import type { WsSession } from '../shared/activitySession';
import {
  useColyseusRoom,
  type ActivityMessage,
} from '../shared/useColyseusRoom';
import type { TowerState } from './towerTypes';

const BLOCK_WIDTH = 46;
const BLOCK_HEIGHT = 16;
const BLOCK_GAP = 3;
const LEVEL_GAP = 3;
const VISIBLE_LEVELS = 10;
const CANVAS_WIDTH = 260;
const BG_COLOR = '#17181a';
const BLOCK_COLOR = '#c9a36a';
const BLOCK_ELIGIBLE_COLOR = '#e8c98a';
const BLOCK_INELIGIBLE_COLOR = '#5a4b36';
const GONE_COLOR = '#2a2b2d';
const SHAKE_DURATION_MS = 260;

interface Props {
  session: WsSession;
  userId: string;
  onMainMenu: () => void;
}

export function TowerCanvas({ session, userId, onMainMenu }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<Application | null>(null);
  const stateRef = useRef<TowerState | null>(null);
  const shakeStartRef = useRef(-Infinity);
  const messageHandlerRef = useRef<(message: ActivityMessage) => void>(
    () => {},
  );
  const [state, setState] = useState<TowerState | null>(null);
  const [joined, setJoined] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);
  const [restartStatus, setRestartStatus] = useState<{
    votes: number;
    required: number;
  } | null>(null);
  const [requested, setRequested] = useState(false);

  const sendLeaveOnDisconnect = useRef(
    (room: { send: (t: string) => void }) => {
      room.send('leave');
    },
  ).current;

  const { send: roomSend, connectionState } = useColyseusRoom(
    'tower-unstable',
    session,
    colyseusUrl(),
    (message) => messageHandlerRef.current(message),
    sendLeaveOnDisconnect,
  );

  useEffect(() => {
    function applyState(next: TowerState) {
      stateRef.current = next;
      setState(next);
      setOpponentDisconnected(false);
      if (next.lastPull?.toppled) shakeStartRef.current = performance.now();
      if (next.status === 'playing') {
        setRestartStatus(null);
        setRequested(false);
      }
    }

    messageHandlerRef.current = (message) => {
      if (message.type === 'init') {
        const payload = message.payload as {
          joined: boolean;
          state: TowerState | null;
        };
        setJoined(payload.joined);
        if (payload.state) applyState(payload.state);
      } else if (
        message.type === 'game_ready' ||
        message.type === 'state_update'
      ) {
        const payload = message.payload as { state: TowerState };
        applyState(payload.state);
      } else if (message.type === 'pull_error') {
        const payload = message.payload as { error: string };
        setError(payload.error);
      } else if (message.type === 'restart_status') {
        setRestartStatus(
          message.payload as { votes: number; required: number },
        );
      } else if (message.type === 'opponent_disconnected') {
        setOpponentDisconnected(true);
      } else if (message.type === 'opponent_reconnected') {
        setOpponentDisconnected(false);
      }
    };

    return () => {
      messageHandlerRef.current = () => {};
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let initialized = false;
    let onContextLost: ((event: Event) => void) | null = null;
    let onContextRestored: (() => void) | null = null;
    let contextCanvas: HTMLCanvasElement | null = null;
    let tick: (() => void) | null = null;

    function onVisibilityChange() {
      if (document.hidden) {
        appRef.current?.ticker.stop();
      } else {
        appRef.current?.ticker.start();
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange);

    const app = new Application();
    appRef.current = app;

    const canvasHeight = VISIBLE_LEVELS * (3 * BLOCK_HEIGHT + LEVEL_GAP) + 40;

    (async () => {
      await Promise.resolve();
      if (cancelled) return;

      await app.init({
        canvas: canvasRef.current!,
        width: CANVAS_WIDTH,
        height: canvasHeight,
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

      function render() {
        const current = stateRef.current;
        app.stage.removeChildren();
        if (!current) return;

        const now = performance.now();
        const shakeElapsed = now - shakeStartRef.current;
        let shakeX = 0;
        let shakeY = 0;
        if (shakeElapsed < SHAKE_DURATION_MS) {
          const progress = shakeElapsed / SHAKE_DURATION_MS;
          const magnitude = 6 * (1 - progress) * (1 - progress);
          shakeX = (Math.random() - 0.5) * 2 * magnitude;
          shakeY = (Math.random() - 0.5) * 2 * magnitude;
        }
        app.stage.position.set(shakeX, shakeY);

        const levels = current.levels;
        const totalLevels = levels.length;
        const startLevel = Math.max(0, totalLevels - VISIBLE_LEVELS);
        const isMyTurn =
          current.status === 'playing' && current.currentPlayer === userId;

        for (let i = startLevel; i < totalLevels; i++) {
          const level = levels[i]!;
          const rowFromTop = totalLevels - 1 - i;
          const y = 20 + rowFromTop * (BLOCK_HEIGHT + LEVEL_GAP);
          const eligible = i < totalLevels - 2;

          for (let pos = 0; pos < level.present.length; pos++) {
            const present = level.present[pos];
            const x =
              CANVAS_WIDTH / 2 -
              (level.present.length * (BLOCK_WIDTH + BLOCK_GAP)) / 2 +
              pos * (BLOCK_WIDTH + BLOCK_GAP);

            const gfx = new Graphics();
            const color = !present
              ? GONE_COLOR
              : eligible
                ? isMyTurn
                  ? BLOCK_ELIGIBLE_COLOR
                  : BLOCK_COLOR
                : BLOCK_INELIGIBLE_COLOR;
            gfx
              .roundRect(0, 0, BLOCK_WIDTH, BLOCK_HEIGHT, 2)
              .fill({ color, alpha: present ? 1 : 0.25 });
            gfx.position.set(x, y);

            if (present && eligible && isMyTurn) {
              gfx.eventMode = 'static';
              gfx.cursor = 'pointer';
              gfx.on('pointerdown', () => {
                roomSend({
                  type: 'pull',
                  payload: { level: i, position: pos },
                });
              });
            }

            app.stage.addChild(gfx);
          }
        }
      }

      tick = () => render();
      app.ticker.add(tick);
    })();

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      messageHandlerRef.current = () => {};
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
        if (tick) app.ticker.remove(tick);
        app.destroy({ removeView: false });
      }
      appRef.current = null;
    };
  }, [roomSend, userId]);

  const isMyTurn =
    state?.status === 'playing' && state.currentPlayer === userId;
  const winnerIsMe = state?.status === 'ended' && state.winner === userId;

  return (
    <div className="flex flex-1 flex-col items-center gap-4 p-6">
      <header className="flex w-full max-w-[420px] items-center justify-between">
        <div className="font-pixel text-sm tracking-[0.28em] text-marquinhos-accent">
          UNSTABLE TOWER
        </div>
        <button
          type="button"
          className="notch-6 border border-marquinhos-border bg-marquinhos-panel px-4 py-2 text-xs uppercase tracking-[0.2em] text-marquinhos-text-dim"
          onClick={onMainMenu}
        >
          Back
        </button>
      </header>

      {!joined && (
        <div className="text-sm text-marquinhos-danger">
          Match is already full — you are spectating.
        </div>
      )}

      <div className="relative border border-marquinhos-border bg-marquinhos-bg">
        <canvas ref={canvasRef} className="block" />
        {!state && (
          <div className="font-pixel animate-pong-blink absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-sm text-marquinhos-text">
            WAITING FOR OPPONENT…
          </div>
        )}
      </div>

      {state && state.status === 'playing' && (
        <div className="text-sm text-marquinhos-text-dim">
          {isMyTurn ? 'Your turn — pull a block' : "Opponent's turn"}
        </div>
      )}

      {state?.lastPull && (
        <div className="text-xs text-marquinhos-text-dim">
          Last pull instability: {(state.lastPull.instability * 100).toFixed(1)}
          %
        </div>
      )}

      {error && <div className="text-sm text-marquinhos-danger">{error}</div>}

      {opponentDisconnected && (
        <div className="font-pixel animate-pong-blink text-sm text-marquinhos-text">
          OPPONENT DISCONNECTED — WAITING…
        </div>
      )}

      {(connectionState === 'disconnected' || connectionState === 'error') && (
        <div className="text-sm text-marquinhos-danger">
          Connection lost. Reload to reconnect.
        </div>
      )}

      {state?.status === 'ended' && (
        <div className="flex flex-col items-center gap-4">
          <div className="font-pixel text-2xl text-marquinhos-text">
            {winnerIsMe ? 'YOU WIN' : 'TOWER TOPPLED'}
          </div>
          <div className="flex gap-4">
            <button
              type="button"
              className="notch-6 cursor-pointer border border-marquinhos-accent bg-marquinhos-accent px-6 py-3 font-mono text-xs tracking-wide text-marquinhos-bg disabled:cursor-not-allowed disabled:opacity-50"
              disabled={requested}
              onClick={() => {
                roomSend({ type: 'restart' });
                setRequested(true);
              }}
            >
              {requested
                ? `WAITING… (${restartStatus?.votes ?? 1}/${restartStatus?.required ?? 2})`
                : 'REMATCH'}
            </button>
            <button
              type="button"
              className="notch-6 cursor-pointer border border-marquinhos-border bg-marquinhos-panel px-6 py-3 font-mono text-xs tracking-wide text-marquinhos-text"
              onClick={onMainMenu}
            >
              MAIN MENU
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
