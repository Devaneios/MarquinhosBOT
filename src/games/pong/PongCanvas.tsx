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
  const lastFrameTimeRef = useRef<number | null>(null);
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
    lastFrameTimeRef.current = null;

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

    let raf: number;
    function render() {
      const canvas = canvasRef.current;
      const latest = latestSnapshotRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) {
        raf = requestAnimationFrame(render);
        return;
      }

      const config = configRef.current;
      const now = performance.now();

      if (!latest) {
        if (canvas.width !== config.width) canvas.width = config.width;
        if (canvas.height !== config.height) canvas.height = config.height;
        ctx.fillStyle = COURT_BG;
        ctx.fillRect(0, 0, config.width, config.height);
      } else {
        const state = latest.state;
        if (canvas.width !== config.width) canvas.width = config.width;
        if (canvas.height !== config.height) canvas.height = config.height;

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
        let paddleLeft = lerp(from.paddles.left, state.paddles.left, t);
        let paddleRight = lerp(from.paddles.right, state.paddles.right, t);

        const side = sideRef.current;
        if (side) {
          const maxY = config.height - config.paddleHeight;
          const dt =
            lastFrameTimeRef.current !== null
              ? (now - lastFrameTimeRef.current) / 1000
              : 0;
          if (predictedYRef.current === null) {
            predictedYRef.current = side === 'left' ? paddleLeft : paddleRight;
          }
          predictedYRef.current = clamp(
            predictedYRef.current +
              currentDirectionRef.current * config.paddleSpeed * dt,
            0,
            maxY,
          );
          if (side === 'left') paddleLeft = predictedYRef.current;
          else paddleRight = predictedYRef.current;
        }
        lastFrameTimeRef.current = now;

        ctx.fillStyle = COURT_BG;
        ctx.fillRect(0, 0, config.width, config.height);

        ctx.strokeStyle = COURT_LINE;
        ctx.lineWidth = 4;
        ctx.setLineDash([24, 20]);
        ctx.beginPath();
        ctx.moveTo(config.width / 2, 0);
        ctx.lineTo(config.width / 2, config.height);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = LEFT_COLOR;
        ctx.fillRect(0, paddleLeft, config.paddleWidth, config.paddleHeight);
        ctx.fillStyle = RIGHT_COLOR;
        ctx.fillRect(
          config.width - config.paddleWidth,
          paddleRight,
          config.paddleWidth,
          config.paddleHeight,
        );

        ctx.fillStyle = BALL_COLOR;
        ctx.beginPath();
        ctx.arc(ballX, ballY, config.ballRadius, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(render);
    }
    raf = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      unsubscribe();
      unsubscribeBinary();
      socket.close();
      socketRef.current = null;
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
