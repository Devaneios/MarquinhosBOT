import { Application, BlurFilter, Graphics } from 'pixi.js';
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
const PARTICLE_MIN_SPEED = 60;
const PARTICLE_MAX_SPEED = 220;
const PARTICLE_RADIUS = 3;
const PARTICLE_LIFETIME_MS = 350;
const PARTICLE_SPAWN_SPREAD = 10;
const PARTICLE_BASE_COUNT = 10;
const PARTICLE_MIN_COUNT = 8;
const PARTICLE_MAX_COUNT = 40;
const BALL_SQUASH_DURATION_MS = 110;
const BALL_SQUASH_AMOUNT = 0.18;
// Mirrors PongEngine's initial ballSpeed (marquinhos-api) — the reference
// point a hit's particle count is scaled against, not derivable client-side.
const BALL_SPEED_REFERENCE = 300;

// Ball FX: comet trail, glow, speed-heat color, and direction-aligned
// stretch/spin. Speed thresholds are tuned against BALL_SPEED_REFERENCE
// (server's initial speed) so the ball only starts looking "hot" once a
// rally has ramped up a few hits.
const BALL_TRAIL_LENGTH = 10;
const BALL_TRAIL_MAX_ALPHA = 0.4;
const BALL_TRAIL_MIN_RADIUS_FACTOR = 0.15;
const BALL_GLOW_SCALE = 2.6;
const BALL_GLOW_ALPHA_BASE = 0.28;
const BALL_HEAT_SPEED_MIN = BALL_SPEED_REFERENCE;
const BALL_HEAT_SPEED_MAX = BALL_SPEED_REFERENCE * 3;
const BALL_COLOR_NUM = 0xf2ede3;
const BALL_HOT_COLOR_NUM = 0xfff45c;
const BALL_STRETCH_MAX = 0.32;
const BALL_STRETCH_SPEED_MAX = BALL_SPEED_REFERENCE * 3;
const BALL_SPIN_RATE = 0.02;
const BALL_MIN_DIR_SPEED = 15;

// Paddle FX: hit flash, impact squash, ambient energy glow, and a motion
// trail that only appears once the paddle is moving fast enough to read as
// intentional (not jitter from reconciliation).
const PADDLE_GLOW_PAD = 6;
const PADDLE_GLOW_ALPHA_BASE = 0.22;
const PADDLE_GLOW_ALPHA_HIT = 0.85;
const PADDLE_GLOW_DECAY_MS = 260;
const PADDLE_FLASH_DURATION_MS = 150;
const PADDLE_FLASH_MAX_ALPHA = 0.85;
const PADDLE_SQUASH_DURATION_MS = 150;
const PADDLE_SQUASH_AMOUNT = 0.22;
const PADDLE_TRAIL_LENGTH = 6;
const PADDLE_TRAIL_SPEED_THRESHOLD = 90;
const PADDLE_TRAIL_MAX_ALPHA = 0.22;
const PADDLE_TRAIL_MAX_AGE_MS = 160;

// Screen shake on paddle contact, scaled by how fast the ball was moving.
const SHAKE_DURATION_MS = 220;
const SHAKE_MAGNITUDE_MIN = 2;
const SHAKE_MAGNITUDE_MAX = 8;

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

function lerpColorHex(colorA: number, colorB: number, t: number): number {
  const clampedT = clamp(t, 0, 1);
  const ar = (colorA >> 16) & 0xff;
  const ag = (colorA >> 8) & 0xff;
  const ab = colorA & 0xff;
  const br = (colorB >> 16) & 0xff;
  const bg = (colorB >> 8) & 0xff;
  const bb = colorB & 0xff;
  const r = Math.round(lerp(ar, br, clampedT));
  const g = Math.round(lerp(ag, bg, clampedT));
  const b = Math.round(lerp(ab, bb, clampedT));
  return (r << 16) | (g << 8) | b;
}

function closestPointOnRect(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
): { x: number; y: number } {
  return { x: clamp(cx, rx, rx + rw), y: clamp(cy, ry, ry + rh) };
}

function circleOverlapsPoint(
  cx: number,
  cy: number,
  radius: number,
  point: { x: number; y: number },
): boolean {
  const dx = cx - point.x;
  const dy = cy - point.y;
  return dx * dx + dy * dy <= radius * radius;
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

interface PaddleTrailPoint {
  y: number;
  age: number;
}

function paddleGlowAlpha(now: number, phase: number, flashStart: number) {
  const idle = PADDLE_GLOW_ALPHA_BASE + 0.1 * Math.sin(now * 0.0035 + phase);
  const hitProgress = clamp(
    (now - flashStart) / PADDLE_GLOW_DECAY_MS,
    0,
    1,
  );
  const hitBoost =
    (PADDLE_GLOW_ALPHA_HIT - PADDLE_GLOW_ALPHA_BASE) *
    (1 - hitProgress) *
    (1 - hitProgress);
  return clamp(idle + hitBoost, 0, 1);
}

function paddleFlashAlpha(now: number, flashStart: number) {
  const progress = clamp((now - flashStart) / PADDLE_FLASH_DURATION_MS, 0, 1);
  return PADDLE_FLASH_MAX_ALPHA * (1 - progress) * (1 - progress);
}

function updatePaddleTrail(
  points: PaddleTrailPoint[],
  centerY: number,
  velocity: number,
  dtMs: number,
) {
  for (const point of points) point.age += dtMs;
  if (Math.abs(velocity) > PADDLE_TRAIL_SPEED_THRESHOLD) {
    points.push({ y: centerY, age: 0 });
  }
  while (points.length > PADDLE_TRAIL_LENGTH) points.shift();
  while (points.length && points[0].age > PADDLE_TRAIL_MAX_AGE_MS) {
    points.shift();
  }
}

function drawPaddleTrail(
  gfx: Graphics,
  points: PaddleTrailPoint[],
  centerX: number,
  color: string,
  width: number,
  height: number,
) {
  gfx.clear();
  for (const point of points) {
    const alpha =
      PADDLE_TRAIL_MAX_ALPHA * (1 - point.age / PADDLE_TRAIL_MAX_AGE_MS);
    gfx
      .rect(centerX - width / 2, point.y - height / 2, width, height)
      .fill({ color, alpha });
  }
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
  const touchingLeftRef = useRef(false);
  const touchingRightRef = useRef(false);
  const ballSquashStartRef = useRef(-Infinity);
  const paddleLeftSquashStartRef = useRef(-Infinity);
  const paddleRightSquashStartRef = useRef(-Infinity);
  const paddleLeftFlashStartRef = useRef(-Infinity);
  const paddleRightFlashStartRef = useRef(-Infinity);
  const shakeStartRef = useRef(-Infinity);
  const shakeMagnitudeRef = useRef(0);
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
    touchingLeftRef.current = false;
    touchingRightRef.current = false;
    ballSquashStartRef.current = -Infinity;
    paddleLeftSquashStartRef.current = -Infinity;
    paddleRightSquashStartRef.current = -Infinity;
    paddleLeftFlashStartRef.current = -Infinity;
    paddleRightFlashStartRef.current = -Infinity;
    shakeStartRef.current = -Infinity;
    shakeMagnitudeRef.current = 0;

    let spawnHitParticles:
      | ((side: Side, x: number, y: number, ballSpeed: number) => void)
      | null = null;

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
      const receivedAt = performance.now();
      prevSnapshotRef.current = latestSnapshotRef.current;
      latestSnapshotRef.current = { state, receivedAt };
      setWinner(state.winner);
      setScore(state.score);
      if (state.winner === null) {
        setRestartStatus(null);
        setRequested(false);
      }

      const config = configRef.current;
      const prevForSpeed = prevSnapshotRef.current;
      let ballSpeed = 0;
      if (prevForSpeed) {
        const dtSeconds = (receivedAt - prevForSpeed.receivedAt) / 1000;
        if (dtSeconds > 0) {
          const dx = state.ball.x - prevForSpeed.state.ball.x;
          const dy = state.ball.y - prevForSpeed.state.ball.y;
          ballSpeed = Math.hypot(dx, dy) / dtSeconds;
        }
      }

      const leftContact = closestPointOnRect(
        state.ball.x,
        state.ball.y,
        0,
        state.paddles.left,
        config.paddleWidth,
        config.paddleHeight,
      );
      const rightContact = closestPointOnRect(
        state.ball.x,
        state.ball.y,
        config.width - config.paddleWidth,
        state.paddles.right,
        config.paddleWidth,
        config.paddleHeight,
      );
      const touchingLeft = circleOverlapsPoint(
        state.ball.x,
        state.ball.y,
        config.ballRadius,
        leftContact,
      );
      const touchingRight = circleOverlapsPoint(
        state.ball.x,
        state.ball.y,
        config.ballRadius,
        rightContact,
      );
      if (touchingLeft && !touchingLeftRef.current) {
        spawnHitParticles?.('left', leftContact.x, leftContact.y, ballSpeed);
        ballSquashStartRef.current = receivedAt;
        paddleLeftSquashStartRef.current = receivedAt;
        paddleLeftFlashStartRef.current = receivedAt;
        shakeStartRef.current = receivedAt;
        shakeMagnitudeRef.current = clamp(
          SHAKE_MAGNITUDE_MAX * (ballSpeed / BALL_SPEED_REFERENCE),
          SHAKE_MAGNITUDE_MIN,
          SHAKE_MAGNITUDE_MAX,
        );
      }
      if (touchingRight && !touchingRightRef.current) {
        spawnHitParticles?.(
          'right',
          rightContact.x,
          rightContact.y,
          ballSpeed,
        );
        ballSquashStartRef.current = receivedAt;
        paddleRightSquashStartRef.current = receivedAt;
        paddleRightFlashStartRef.current = receivedAt;
        shakeStartRef.current = receivedAt;
        shakeMagnitudeRef.current = clamp(
          SHAKE_MAGNITUDE_MAX * (ballSpeed / BALL_SPEED_REFERENCE),
          SHAKE_MAGNITUDE_MIN,
          SHAKE_MAGNITUDE_MAX,
        );
      }
      touchingLeftRef.current = touchingLeft;
      touchingRightRef.current = touchingRight;

      const side = sideRef.current;
      if (!side) return;
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
    let paddleLeftGlow: Graphics;
    let paddleRightGlow: Graphics;
    let paddleLeftTrail: Graphics;
    let paddleRightTrail: Graphics;
    let paddleLeftFlash: Graphics;
    let paddleRightFlash: Graphics;
    let ball: Graphics;
    let ballGlow: Graphics;
    let ballTrail: Graphics;
    let particlesGfx: Graphics;

    interface Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      life: number;
      color: string;
    }
    let particles: Particle[] = [];

    // Frame-to-frame ball/paddle motion tracking, used to derive velocity
    // for the ball's heat/stretch/spin FX and the paddles' trail/tilt FX.
    // Reset naturally on every effect re-run since these are plain closure
    // variables, not refs.
    let prevRenderBallX: number | null = null;
    let prevRenderBallY: number | null = null;
    let lastBallDirAngle = 0;
    let ballSpinAngle = 0;
    let ballTrailPoints: { x: number; y: number }[] = [];
    let prevLeftCenterY: number | null = null;
    let prevRightCenterY: number | null = null;
    let leftTrailPoints: PaddleTrailPoint[] = [];
    let rightTrailPoints: PaddleTrailPoint[] = [];

    const app = new Application();
    appRef.current = app;

    function drawStaticGeometry(config: PongConfig) {
      const hw = config.paddleWidth / 2;
      const hh = config.paddleHeight / 2;

      paddleLeft
        .clear()
        .rect(-hw, -hh, config.paddleWidth, config.paddleHeight)
        .fill(LEFT_COLOR);
      paddleRight
        .clear()
        .rect(-hw, -hh, config.paddleWidth, config.paddleHeight)
        .fill(RIGHT_COLOR);

      paddleLeftFlash
        .clear()
        .rect(-hw, -hh, config.paddleWidth, config.paddleHeight)
        .fill(0xffffff);
      paddleRightFlash
        .clear()
        .rect(-hw, -hh, config.paddleWidth, config.paddleHeight)
        .fill(0xffffff);

      paddleLeftGlow
        .clear()
        .roundRect(
          -hw - PADDLE_GLOW_PAD,
          -hh - PADDLE_GLOW_PAD,
          config.paddleWidth + PADDLE_GLOW_PAD * 2,
          config.paddleHeight + PADDLE_GLOW_PAD * 2,
          6,
        )
        .fill(LEFT_COLOR);
      paddleRightGlow
        .clear()
        .roundRect(
          -hw - PADDLE_GLOW_PAD,
          -hh - PADDLE_GLOW_PAD,
          config.paddleWidth + PADDLE_GLOW_PAD * 2,
          config.paddleHeight + PADDLE_GLOW_PAD * 2,
          6,
        )
        .fill(RIGHT_COLOR);

      ballGlow
        .clear()
        .circle(0, 0, config.ballRadius * BALL_GLOW_SCALE)
        .fill(0xffffff);

      paddleLeft.position.x = hw;
      paddleLeftFlash.position.x = hw;
      paddleLeftGlow.position.x = hw;
      paddleRight.position.x = config.width - hw;
      paddleRightFlash.position.x = config.width - hw;
      paddleRightGlow.position.x = config.width - hw;
    }

    function buildScene(config: PongConfig) {
      centerLine = new Graphics();
      drawDashedVerticalLine(centerLine, config.width / 2, config.height);

      ballTrail = new Graphics();

      paddleLeftGlow = new Graphics();
      paddleRightGlow = new Graphics();
      paddleLeftGlow.filters = [new BlurFilter({ strength: 10, quality: 3 })];
      paddleRightGlow.filters = [
        new BlurFilter({ strength: 10, quality: 3 }),
      ];
      paddleLeftGlow.alpha = PADDLE_GLOW_ALPHA_BASE;
      paddleRightGlow.alpha = PADDLE_GLOW_ALPHA_BASE;

      paddleLeftTrail = new Graphics();
      paddleRightTrail = new Graphics();

      paddleLeft = new Graphics();
      paddleRight = new Graphics();

      paddleLeftFlash = new Graphics();
      paddleRightFlash = new Graphics();
      paddleLeftFlash.alpha = 0;
      paddleRightFlash.alpha = 0;

      ballGlow = new Graphics();
      ballGlow.filters = [new BlurFilter({ strength: 12, quality: 3 })];

      ball = new Graphics();
      particlesGfx = new Graphics();

      drawStaticGeometry(config);

      app.stage.addChild(
        centerLine,
        ballTrail,
        paddleLeftGlow,
        paddleRightGlow,
        paddleLeftTrail,
        paddleRightTrail,
        paddleLeft,
        paddleLeftFlash,
        paddleRight,
        paddleRightFlash,
        ballGlow,
        ball,
        particlesGfx,
      );
      lastConfig = config;
    }

    spawnHitParticles = (side, x, y, ballSpeed) => {
      if (!initialized) return;
      const color = side === 'left' ? LEFT_COLOR : RIGHT_COLOR;
      const baseAngle = side === 'left' ? 0 : Math.PI;
      const count = clamp(
        Math.round(
          PARTICLE_BASE_COUNT * (ballSpeed / BALL_SPEED_REFERENCE),
        ),
        PARTICLE_MIN_COUNT,
        PARTICLE_MAX_COUNT,
      );
      for (let i = 0; i < count; i++) {
        const angle = baseAngle + (Math.random() - 0.5) * (Math.PI * 0.7);
        const speed =
          PARTICLE_MIN_SPEED +
          Math.random() * (PARTICLE_MAX_SPEED - PARTICLE_MIN_SPEED);
        particles.push({
          x: x + (Math.random() - 0.5) * PARTICLE_SPAWN_SPREAD,
          y: y + (Math.random() - 0.5) * PARTICLE_SPAWN_SPREAD,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: PARTICLE_LIFETIME_MS,
          color,
        });
      }
    };

    function applyConfigChange(config: PongConfig) {
      lastConfig = config;
      app.renderer.resize(config.width, config.height);
      drawDashedVerticalLine(centerLine, config.width / 2, config.height);
      drawStaticGeometry(config);
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

        const dtMs = app.ticker.deltaMS;
        const dtSeconds = dtMs / 1000;
        const now = performance.now();

        particlesGfx.clear();
        particles = particles.filter((particle) => particle.life > 0);
        for (const particle of particles) {
          particle.x += particle.vx * dtSeconds;
          particle.y += particle.vy * dtSeconds;
          particle.life -= dtMs;
          const alpha = Math.max(particle.life / PARTICLE_LIFETIME_MS, 0);
          particlesGfx
            .circle(particle.x, particle.y, PARTICLE_RADIUS)
            .fill({ color: particle.color, alpha });
        }

        // Screen shake decays on its own clock, independent of snapshots.
        const shakeElapsed = now - shakeStartRef.current;
        if (shakeElapsed < SHAKE_DURATION_MS) {
          const shakeProgress = shakeElapsed / SHAKE_DURATION_MS;
          const shakeDecay = (1 - shakeProgress) * (1 - shakeProgress);
          const magnitude = shakeMagnitudeRef.current * shakeDecay;
          app.stage.position.set(
            (Math.random() - 0.5) * 2 * magnitude,
            (Math.random() - 0.5) * 2 * magnitude,
          );
        } else {
          app.stage.position.set(0, 0);
        }

        const latest = latestSnapshotRef.current;
        if (!latest) return;

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
          if (predictedYRef.current === null) {
            predictedYRef.current = side === 'left' ? leftY : rightY;
          }
          predictedYRef.current = clamp(
            predictedYRef.current +
              currentDirectionRef.current * config.paddleSpeed * dtSeconds,
            0,
            maxY,
          );
          if (side === 'left') leftY = predictedYRef.current;
          else rightY = predictedYRef.current;
        }

        // --- Ball: frame-to-frame velocity drives heat color, a comet
        // trail, a glow halo, and a direction-aligned stretch. Paddle
        // impacts layer a brief squash on top (ballSquashStartRef). ---
        let frameSpeed = 0;
        if (prevRenderBallX !== null && prevRenderBallY !== null && dtSeconds > 0) {
          const fvx = (ballX - prevRenderBallX) / dtSeconds;
          const fvy = (ballY - prevRenderBallY) / dtSeconds;
          frameSpeed = Math.hypot(fvx, fvy);
          if (frameSpeed > BALL_MIN_DIR_SPEED) {
            lastBallDirAngle = Math.atan2(fvy, fvx);
          }
        }
        prevRenderBallX = ballX;
        prevRenderBallY = ballY;

        const speedNorm = clamp(
          (frameSpeed - BALL_HEAT_SPEED_MIN) /
            (BALL_HEAT_SPEED_MAX - BALL_HEAT_SPEED_MIN),
          0,
          1,
        );
        const heatColor = lerpColorHex(
          BALL_COLOR_NUM,
          BALL_HOT_COLOR_NUM,
          speedNorm,
        );

        ballSpinAngle += frameSpeed * dtSeconds * BALL_SPIN_RATE;

        const squashProgress = clamp(
          (now - ballSquashStartRef.current) / BALL_SQUASH_DURATION_MS,
          0,
          1,
        );
        const squashDecay = (1 - squashProgress) * (1 - squashProgress);
        const hitSquash = BALL_SQUASH_AMOUNT * squashDecay;
        const stretch =
          BALL_STRETCH_MAX * clamp(frameSpeed / BALL_STRETCH_SPEED_MAX, 0, 1);

        ball.clear();
        ball.circle(0, 0, config.ballRadius).fill(heatColor);
        const highlightOffset = config.ballRadius * 0.42;
        ball
          .circle(
            Math.cos(ballSpinAngle) * highlightOffset,
            Math.sin(ballSpinAngle) * highlightOffset,
            config.ballRadius * 0.26,
          )
          .fill({ color: 0xffffff, alpha: 0.55 });
        ball.rotation = lastBallDirAngle;
        ball.scale.set(
          (1 + stretch) * (1 - hitSquash),
          (1 - stretch * 0.5) * (1 + hitSquash * 1.4),
        );
        ball.position.set(ballX, ballY);

        ballGlow.tint = heatColor;
        ballGlow.alpha = clamp(
          BALL_GLOW_ALPHA_BASE + 0.4 * speedNorm + 0.35 * squashDecay,
          0,
          0.9,
        );
        ballGlow.scale.set(1 + 0.5 * squashDecay);
        ballGlow.position.set(ballX, ballY);

        ballTrailPoints.unshift({ x: ballX, y: ballY });
        if (ballTrailPoints.length > BALL_TRAIL_LENGTH) {
          ballTrailPoints.length = BALL_TRAIL_LENGTH;
        }
        ballTrail.clear();
        for (let i = 0; i < ballTrailPoints.length; i++) {
          const point = ballTrailPoints[i];
          const trailT = i / ballTrailPoints.length;
          const alpha =
            BALL_TRAIL_MAX_ALPHA * (1 - trailT) * (0.4 + 0.6 * speedNorm);
          const radius =
            config.ballRadius * lerp(1, BALL_TRAIL_MIN_RADIUS_FACTOR, trailT);
          ballTrail
            .circle(point.x, point.y, radius)
            .fill({ color: heatColor, alpha });
        }

        // --- Paddles: impact squash/flash/glow, a velocity-driven tilt,
        // and a motion trail that only appears above a speed threshold. ---
        const leftCenterY = leftY + config.paddleHeight / 2;
        const rightCenterY = rightY + config.paddleHeight / 2;
        const leftVelocity =
          prevLeftCenterY !== null && dtSeconds > 0
            ? (leftCenterY - prevLeftCenterY) / dtSeconds
            : 0;
        const rightVelocity =
          prevRightCenterY !== null && dtSeconds > 0
            ? (rightCenterY - prevRightCenterY) / dtSeconds
            : 0;
        prevLeftCenterY = leftCenterY;
        prevRightCenterY = rightCenterY;

        const leftSquashProgress = clamp(
          (now - paddleLeftSquashStartRef.current) /
            PADDLE_SQUASH_DURATION_MS,
          0,
          1,
        );
        const rightSquashProgress = clamp(
          (now - paddleRightSquashStartRef.current) /
            PADDLE_SQUASH_DURATION_MS,
          0,
          1,
        );
        const leftSquash =
          PADDLE_SQUASH_AMOUNT *
          (1 - leftSquashProgress) *
          (1 - leftSquashProgress);
        const rightSquash =
          PADDLE_SQUASH_AMOUNT *
          (1 - rightSquashProgress) *
          (1 - rightSquashProgress);

        paddleLeft.position.y = leftCenterY;
        paddleRight.position.y = rightCenterY;
        paddleLeft.scale.set(1 + leftSquash * 1.2, 1 - leftSquash);
        paddleRight.scale.set(1 + rightSquash * 1.2, 1 - rightSquash);

        paddleLeftGlow.position.y = leftCenterY;
        paddleRightGlow.position.y = rightCenterY;
        paddleLeftGlow.alpha = paddleGlowAlpha(
          now,
          0,
          paddleLeftFlashStartRef.current,
        );
        paddleRightGlow.alpha = paddleGlowAlpha(
          now,
          Math.PI,
          paddleRightFlashStartRef.current,
        );

        paddleLeftFlash.position.y = leftCenterY;
        paddleRightFlash.position.y = rightCenterY;
        paddleLeftFlash.alpha = paddleFlashAlpha(
          now,
          paddleLeftFlashStartRef.current,
        );
        paddleRightFlash.alpha = paddleFlashAlpha(
          now,
          paddleRightFlashStartRef.current,
        );

        updatePaddleTrail(leftTrailPoints, leftCenterY, leftVelocity, dtMs);
        updatePaddleTrail(
          rightTrailPoints,
          rightCenterY,
          rightVelocity,
          dtMs,
        );
        drawPaddleTrail(
          paddleLeftTrail,
          leftTrailPoints,
          config.paddleWidth / 2,
          LEFT_COLOR,
          config.paddleWidth,
          config.paddleHeight,
        );
        drawPaddleTrail(
          paddleRightTrail,
          rightTrailPoints,
          config.width - config.paddleWidth / 2,
          RIGHT_COLOR,
          config.paddleWidth,
          config.paddleHeight,
        );
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
          <div
            key={`left-${score?.left ?? 0}`}
            className="pong-heading pong-game-score pong-score-pop"
          >
            {score?.left ?? 0}
          </div>
        </div>
        <div className="pong-game-player pong-game-player-right">
          <div className="pong-heading pong-game-player-name">{p2Name}</div>
          <div
            key={`right-${score?.right ?? 0}`}
            className="pong-heading pong-game-score pong-score-pop"
          >
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
