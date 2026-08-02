import { Application, Graphics } from 'pixi.js';
import { useEffect, useRef, useState } from 'react';
import type { GameMode } from '../../hooks/useDiscordAuth';
import { wsUrl } from '../../lib/apiBase';
import { ActivitySocket, type ActivityMessage } from '../../lib/ws';
import { decodeStateSnapshot, type DecodedSnapshot } from './pongProtocol';

type Side = 'left' | 'right';

const COURT_BG = '#0c0a10';
const COURT_LINE = '#3a3542';
const LEFT_COLOR = '#e8332c';
const RIGHT_COLOR = '#2f9e64';
const BALL_COLOR = '#f2ede3';

interface PongConfig {
  width: number;
  height: number;
  paddleWidth: number;
  paddleHeight: number;
  paddleSpeed: number;
  ballRadius: number;
}

const PADDLE_WIDTH = 12;
const PADDLE_HEIGHT = 80;
const BALL_RADIUS = 8;
const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 480;
const DEFAULT_TICK_MS = 16;
const DEFAULT_PADDLE_SPEED = 400;
const RECONCILE_FACTOR = 0.2;

const DEFAULT_CONFIG: PongConfig = {
  width: DEFAULT_WIDTH,
  height: DEFAULT_HEIGHT,
  paddleWidth: PADDLE_WIDTH,
  paddleHeight: PADDLE_HEIGHT,
  paddleSpeed: DEFAULT_PADDLE_SPEED,
  ballRadius: BALL_RADIUS,
};

interface Snapshot {
  state: DecodedSnapshot;
  receivedAt: number;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function drawDashedVerticalLine(
  graphics: Graphics,
  x: number,
  height: number,
  dash = 24,
  gap = 20,
  color = COURT_LINE,
  width = 4,
) {
  graphics.clear();
  let y = 0;
  while (y < height) {
    const segmentEnd = Math.min(y + dash, height);
    graphics.moveTo(x, y).lineTo(x, segmentEnd);
    y += dash + gap;
  }
  graphics.stroke({ width, color });
}

export function PongCanvas({
  wsToken,
  mode,
}: {
  wsToken: string;
  mode: GameMode;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const latestSnapshotRef = useRef<Snapshot | null>(null);
  const prevSnapshotRef = useRef<Snapshot | null>(null);
  const sideRef = useRef<Side | null>(null);
  const configRef = useRef<PongConfig>(DEFAULT_CONFIG);
  const nextSeqRef = useRef(0);
  const currentDirectionRef = useRef<-1 | 0 | 1>(0);
  const predictedYRef = useRef<number | null>(null);
  const appRef = useRef<Application | null>(null);
  const [winner, setWinner] = useState<'left' | 'right' | null>(null);
  const [score, setScore] = useState<{ left: number; right: number } | null>(
    null,
  );
  const [restartStatus, setRestartStatus] = useState<{
    votes: number;
    required: number;
  } | null>(null);
  const [requested, setRequested] = useState(false);
  const socketRef = useRef<ActivitySocket | null>(null);

  useEffect(() => {
    const socket = new ActivitySocket(
      `${wsUrl('/ws/activity')}?token=${encodeURIComponent(wsToken)}`,
    );
    socketRef.current = socket;
    latestSnapshotRef.current = null;
    prevSnapshotRef.current = null;
    sideRef.current = null;
    configRef.current = DEFAULT_CONFIG;
    nextSeqRef.current = 0;
    currentDirectionRef.current = 0;
    predictedYRef.current = null;

    const unsubscribe = socket.onMessage((message: ActivityMessage) => {
      if (message.type === 'init') {
        const payload = message.payload as { side: Side; config: PongConfig };
        sideRef.current = payload.side;
        configRef.current = payload.config;
      } else if (message.type === 'restart_status') {
        setRestartStatus(
          message.payload as { votes: number; required: number },
        );
      }
    });

    const unsubscribeBinary = socket.onBinaryMessage((data: ArrayBuffer) => {
      const state = decodeStateSnapshot(data);
      prevSnapshotRef.current = latestSnapshotRef.current;
      latestSnapshotRef.current = { state, receivedAt: performance.now() };
      setWinner(state.winner);
      setScore(state.score);
      if (state.winner === null) {
        setRestartStatus(null);
        setRequested(false);
      }

      const side = sideRef.current;
      if (!side) return;
      const config = configRef.current;
      const authoritativeY =
        side === 'left' ? state.paddles.left : state.paddles.right;

      // Reconcile the local prediction against the server's authoritative
      // position: nudge it a bit closer on every snapshot to correct for
      // slow drift, or snap outright on a large desync (e.g. reconnect).
      if (predictedYRef.current === null) {
        predictedYRef.current = authoritativeY;
      } else if (
        Math.abs(authoritativeY - predictedYRef.current) > config.paddleHeight
      ) {
        predictedYRef.current = authoritativeY;
      } else {
        predictedYRef.current +=
          (authoritativeY - predictedYRef.current) * RECONCILE_FACTOR;
      }
    });

    socket.connect();

    const keysDown = new Set<string>();
    function sendInput() {
      const direction: -1 | 0 | 1 = keysDown.has('ArrowUp')
        ? -1
        : keysDown.has('ArrowDown')
          ? 1
          : 0;
      if (direction === currentDirectionRef.current) return;
      currentDirectionRef.current = direction;
      const seq = ++nextSeqRef.current;
      socket.send({ type: 'input', payload: { direction, seq } });
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
      event.preventDefault();
      keysDown.add(event.key);
      sendInput();
    }
    function onKeyUp(event: KeyboardEvent) {
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
      keysDown.delete(event.key);
      sendInput();
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    let cancelled = false;
    let initialized = false;
    let tick: (() => void) | null = null;
    let lastConfig: PongConfig = DEFAULT_CONFIG;
    let centerLine: Graphics;
    let paddleLeft: Graphics;
    let paddleRight: Graphics;
    let ball: Graphics;

    const app = new Application();
    appRef.current = app;

    function buildScene(config: PongConfig) {
      centerLine = new Graphics();
      drawDashedVerticalLine(centerLine, config.width / 2, config.height);

      paddleLeft = new Graphics()
        .rect(0, 0, config.paddleWidth, config.paddleHeight)
        .fill(LEFT_COLOR);

      paddleRight = new Graphics()
        .rect(0, 0, config.paddleWidth, config.paddleHeight)
        .fill(RIGHT_COLOR);
      paddleRight.position.x = config.width - config.paddleWidth;

      ball = new Graphics().circle(0, 0, config.ballRadius).fill(BALL_COLOR);

      app.stage.addChild(centerLine, paddleLeft, paddleRight, ball);
      lastConfig = config;
    }

    function applyConfigChange(config: PongConfig) {
      lastConfig = config;
      app.renderer.resize(config.width, config.height);
      drawDashedVerticalLine(centerLine, config.width / 2, config.height);
      paddleLeft
        .clear()
        .rect(0, 0, config.paddleWidth, config.paddleHeight)
        .fill(LEFT_COLOR);
      paddleRight
        .clear()
        .rect(0, 0, config.paddleWidth, config.paddleHeight)
        .fill(RIGHT_COLOR);
      paddleRight.position.x = config.width - config.paddleWidth;
      ball.clear().circle(0, 0, config.ballRadius).fill(BALL_COLOR);
    }

    (async () => {
      // Yield a microtask before touching the canvas. React 19 StrictMode
      // double-invokes this effect synchronously (mount, cleanup, mount)
      // before any promise settles. If both invocations called app.init()
      // on the same <canvas>, they'd end up sharing one underlying WebGL
      // context (getContext() returns the existing context on a second
      // call) — then the stale instance's cleanup would call destroy(),
      // which kills that shared context out from under the real instance,
      // leaving a permanently blank canvas. Checking `cancelled` after a
      // microtask tick lets the phantom first invocation bail out here,
      // before it ever calls init(), so only the real instance touches the
      // canvas.
      await Promise.resolve();
      if (cancelled) return;

      await app.init({
        canvas: canvasRef.current!,
        width: configRef.current.width,
        height: configRef.current.height,
        background: COURT_BG,
        antialias: true,
        resolution: window.devicePixelRatio,
        autoDensity: true,
      });
      if (cancelled) {
        app.destroy({ removeView: false });
        return;
      }
      initialized = true;
      buildScene(configRef.current);

      tick = () => {
        const config = configRef.current;
        if (config !== lastConfig) applyConfigChange(config);

        const latest = latestSnapshotRef.current;
        if (!latest) return;

        const now = performance.now();
        const state = latest.state;
        const prev = prevSnapshotRef.current;
        const interval = prev
          ? latest.receivedAt - prev.receivedAt
          : DEFAULT_TICK_MS;
        const safeInterval = interval > 0 ? interval : DEFAULT_TICK_MS;
        const t = Math.min(
          Math.max((now - latest.receivedAt) / safeInterval, 0),
          1,
        );
        const from = prev ? prev.state : state;

        const ballX = lerp(from.ball.x, state.ball.x, t);
        const ballY = lerp(from.ball.y, state.ball.y, t);
        let leftY = lerp(from.paddles.left, state.paddles.left, t);
        let rightY = lerp(from.paddles.right, state.paddles.right, t);

        const side = sideRef.current;
        if (side) {
          const maxY = config.height - config.paddleHeight;
          const dt = app.ticker.deltaMS / 1000;
          if (predictedYRef.current === null) {
            predictedYRef.current = side === 'left' ? leftY : rightY;
          }
          predictedYRef.current = clamp(
            predictedYRef.current +
              currentDirectionRef.current * config.paddleSpeed * dt,
            0,
            maxY,
          );
          if (side === 'left') leftY = predictedYRef.current;
          else rightY = predictedYRef.current;
        }

        paddleLeft.position.y = leftY;
        paddleRight.position.y = rightY;
        ball.position.set(ballX, ballY);
      };
      app.ticker.add(tick);
    })();

    return () => {
      cancelled = true;
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      unsubscribe();
      unsubscribeBinary();
      socket.close();
      socketRef.current = null;
      if (initialized) {
        if (tick) app.ticker.remove(tick);
        app.destroy({ removeView: false });
      }
      appRef.current = null;
    };
  }, [wsToken]);

  const p1Name = 'PLAYER 1';
  const p2Name = mode === 'single' ? 'CPU' : 'PLAYER 2';
  const winnerName =
    winner === 'left' ? p1Name : winner === 'right' ? p2Name : '';

  return (
    <div className="pong-screen pong-in-game">
      <div className="pong-game-header">
        <div className="pong-game-player pong-game-player-left">
          <div className="pong-heading pong-game-player-name">{p1Name}</div>
          <div className="pong-heading pong-game-score">{score?.left ?? 0}</div>
        </div>
        <div className="pong-game-player pong-game-player-right">
          <div className="pong-heading pong-game-player-name">{p2Name}</div>
          <div className="pong-heading pong-game-score">
            {score?.right ?? 0}
          </div>
        </div>
      </div>

      <div className="pong-court">
        <canvas ref={canvasRef} className="pong-canvas" />
        {!score && (
          <div className="pong-heading pong-blink-text pong-waiting">
            WAITING FOR OPPONENT…
          </div>
        )}
        {winner && (
          <div className="pong-game-over">
            <div className="pong-heading pong-game-over-title">
              {winnerName} WINS
            </div>
            <div className="pong-heading pong-game-over-score">
              <span className="pong-game-over-score-left">{score?.left}</span>
              <span className="pong-game-over-score-sep">—</span>
              <span className="pong-game-over-score-right">{score?.right}</span>
            </div>
            <div className="pong-game-over-actions">
              <button
                type="button"
                className="pong-btn pong-btn-primary"
                disabled={requested}
                onClick={() => {
                  socketRef.current?.send({ type: 'restart' });
                  setRequested(true);
                }}
              >
                {requested
                  ? `WAITING… (${restartStatus?.votes ?? 1}/${restartStatus?.required ?? 2})`
                  : 'REMATCH'}
              </button>
              <button
                type="button"
                className="pong-btn pong-btn-secondary"
                onClick={() => window.location.reload()}
              >
                MAIN MENU
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
