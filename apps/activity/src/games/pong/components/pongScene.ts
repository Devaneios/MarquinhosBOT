import type { PongPublicConfig } from '@marquinhos/contracts/activity/games/pong';
import type { DecodedSnapshot } from '@marquinhos/contracts/activity/pong/codec';
import { Application, BlurFilter, Graphics } from 'pixi.js';
import type { Side } from '../pongTypes';

const COURT_BG = '#17181a';
const COURT_LINE = '#34363a';
const LEFT_COLOR = '#ffb000';
const RIGHT_COLOR = '#5fbf77';

export type PongConfig = Pick<
  PongPublicConfig,
  | 'width'
  | 'height'
  | 'paddleWidth'
  | 'paddleHeight'
  | 'paddleSpeed'
  | 'ballRadius'
  | 'cornerGap'
>;

const PADDLE_WIDTH = 12;
const PADDLE_HEIGHT = 80;
const BALL_RADIUS = 8;
const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 480;
const DEFAULT_PADDLE_SPEED = 400;
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

export const DEFAULT_CONFIG: PongConfig = {
  width: DEFAULT_WIDTH,
  height: DEFAULT_HEIGHT,
  paddleWidth: PADDLE_WIDTH,
  paddleHeight: PADDLE_HEIGHT,
  paddleSpeed: DEFAULT_PADDLE_SPEED,
  ballRadius: BALL_RADIUS,
  cornerGap: 0,
};

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

export function closestPointOnRect(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
): { x: number; y: number } {
  return { x: clamp(cx, rx, rx + rw), y: clamp(cy, ry, ry + rh) };
}

export function circleOverlapsPoint(
  cx: number,
  cy: number,
  radius: number,
  point: { x: number; y: number },
): boolean {
  const dx = cx - point.x;
  const dy = cy - point.y;
  return dx * dx + dy * dy <= radius * radius;
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
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
  const hitProgress = clamp((now - flashStart) / PADDLE_GLOW_DECAY_MS, 0, 1);
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

export interface PongSceneFrame {
  config: PongConfig;
  state: DecodedSnapshot | null;
  leftY: number | null;
  rightY: number | null;
  elapsedMs: number | null;
}

export interface PongSceneOptions {
  canvas: HTMLCanvasElement;
  getTimer: () => HTMLDivElement | null;
  getFrame: (now: number) => PongSceneFrame;
  onResume: () => void;
}

export interface PongSceneHandle {
  paddleHit: (
    side: Side,
    x: number,
    y: number,
    ballSpeed: number,
    at: number,
  ) => void;
  dispose: () => void;
}

export function createPongScene({
  canvas,
  getTimer,
  getFrame,
  onResume,
}: PongSceneOptions): PongSceneHandle {
  let ballSquashStart = -Infinity;
  let paddleLeftSquashStart = -Infinity;
  let paddleRightSquashStart = -Infinity;
  let paddleLeftFlashStart = -Infinity;
  let paddleRightFlashStart = -Infinity;
  let shakeStart = -Infinity;
  let shakeMagnitude = 0;

  let cancelled = false;
  let initialized = false;
  let tick: (() => void) | null = null;
  let onContextLost: ((event: Event) => void) | null = null;
  let onContextRestored: (() => void) | null = null;
  let contextCanvas: HTMLCanvasElement | null = null;

  function onVisibilityChange() {
    if (!initialized) return;
    if (document.hidden) {
      app.ticker.stop();
    } else {
      onResume();
      app.ticker.start();
    }
  }
  document.addEventListener('visibilitychange', onVisibilityChange);
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
  let variantEntities: Graphics;

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
    paddleRightGlow.filters = [new BlurFilter({ strength: 10, quality: 3 })];
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
    variantEntities = new Graphics();

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
      variantEntities,
      particlesGfx,
    );
    lastConfig = config;
  }

  function spawnHitParticles(
    side: Side,
    x: number,
    y: number,
    ballSpeed: number,
  ) {
    if (!initialized) return;
    const color = side === 'left' ? LEFT_COLOR : RIGHT_COLOR;
    const baseAngle = side === 'left' ? 0 : Math.PI;
    const count = clamp(
      Math.round(PARTICLE_BASE_COUNT * (ballSpeed / BALL_SPEED_REFERENCE)),
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
  }

  function applyConfigChange(config: PongConfig) {
    lastConfig = config;
    app.renderer.resize(config.width, config.height);
    canvas.style.width = `min(100%, ${config.width}px)`;
    canvas.style.height = 'auto';
    canvas.style.aspectRatio = `${config.width} / ${config.height}`;
    drawDashedVerticalLine(centerLine, config.width / 2, config.height);
    drawStaticGeometry(config);
  }

  const initialConfig = getFrame(performance.now()).config;

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
      canvas,
      width: initialConfig.width,
      height: initialConfig.height,
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
    buildScene(initialConfig);
    canvas.style.width = `min(100%, ${initialConfig.width}px)`;
    canvas.style.height = 'auto';
    canvas.style.aspectRatio = `${initialConfig.width} / ${initialConfig.height}`;

    onContextLost = (event: Event) => {
      event.preventDefault();
      app.ticker.stop();
    };
    onContextRestored = () => {
      app.ticker.start();
    };
    contextCanvas = canvas;
    contextCanvas.addEventListener('webglcontextlost', onContextLost, false);
    contextCanvas.addEventListener(
      'webglcontextrestored',
      onContextRestored,
      false,
    );

    tick = () => {
      const now = performance.now();
      const dtMs = app.ticker.deltaMS;
      const dtSeconds = dtMs / 1000;
      const frame = getFrame(now);
      const config = frame.config;
      if (config !== lastConfig) applyConfigChange(config);
      const timerElement = getTimer();
      if (frame.elapsedMs !== null && timerElement) {
        timerElement.textContent = formatElapsed(frame.elapsedMs);
      }

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
      const shakeElapsed = now - shakeStart;
      if (shakeElapsed < SHAKE_DURATION_MS) {
        const shakeProgress = shakeElapsed / SHAKE_DURATION_MS;
        const shakeDecay = (1 - shakeProgress) * (1 - shakeProgress);
        const magnitude = shakeMagnitude * shakeDecay;
        app.stage.position.set(
          (Math.random() - 0.5) * 2 * magnitude,
          (Math.random() - 0.5) * 2 * magnitude,
        );
      } else {
        app.stage.position.set(0, 0);
      }

      if (frame.state === null || frame.leftY === null || frame.rightY === null)
        return;

      const state = frame.state;
      const ballX = state.ball.x;
      const ballY = state.ball.y;
      const leftY = frame.leftY;
      const rightY = frame.rightY;

      const classic = state.ruleset === 'classic-1v1';
      paddleLeft.visible = classic;
      paddleRight.visible = classic;
      paddleLeftGlow.visible = classic;
      paddleRightGlow.visible = classic;
      paddleLeftTrail.visible = classic;
      paddleRightTrail.visible = classic;
      paddleLeftFlash.visible = classic;
      paddleRightFlash.visible = classic;
      variantEntities.clear();
      if (!classic) {
        if (state.arena === 'circular') {
          variantEntities
            .circle(
              config.width / 2,
              config.height / 2,
              Math.min(config.width, config.height) * 0.46,
            )
            .stroke({ width: 3, color: COURT_LINE });
        }
        for (const brick of state.bricks) {
          if (!brick.active) continue;
          variantEntities
            .rect(brick.x, brick.y, brick.width, brick.height)
            .fill({ color: 0x5f6670, alpha: 0.85 })
            .stroke({ width: 1, color: 0xaeb4bd });
        }
        for (const paddle of state.paddles) {
          if (!paddle.active) continue;
          const color = paddle.team % 2 === 0 ? LEFT_COLOR : RIGHT_COLOR;
          if (paddle.orientation === 'radial') {
            const radius = Math.min(config.width, config.height) * 0.46;
            const start = paddle.angle - paddle.arc / 2;
            variantEntities
              .moveTo(
                config.width / 2 + Math.cos(start) * radius,
                config.height / 2 + Math.sin(start) * radius,
              )
              .arc(
                config.width / 2,
                config.height / 2,
                radius,
                start,
                paddle.angle + paddle.arc / 2,
              )
              .stroke({ width: paddle.width, color });
          } else {
            variantEntities
              .rect(
                paddle.x,
                paddle.y,
                paddle.width * paddle.sizeMultiplier,
                paddle.height * paddle.sizeMultiplier,
              )
              .fill(color);
          }
          if (paddle.shield > 0) {
            variantEntities
              .rect(
                paddle.x - 4,
                paddle.y - 4,
                paddle.width * paddle.sizeMultiplier + 8,
                paddle.height * paddle.sizeMultiplier + 8,
              )
              .stroke({ width: 2, color: 0x58d8ff });
          }
        }
        for (const extraBall of state.balls.slice(1)) {
          if (!extraBall.active) continue;
          variantEntities
            .circle(extraBall.x, extraBall.y, extraBall.radius)
            .fill(BALL_COLOR_NUM);
        }
        for (const powerUp of state.powerUps) {
          if (!powerUp.active) continue;
          variantEntities
            .circle(powerUp.x, powerUp.y, powerUp.radius)
            .fill(0xffd84a)
            .stroke({ width: 2, color: 0xffffff });
        }
      }

      // --- Ball: frame-to-frame velocity drives heat color, a comet
      // trail, a glow halo, and a direction-aligned stretch. Paddle
      // impacts layer a brief squash on top (ballSquashStartRef). ---
      let frameSpeed = 0;
      if (
        prevRenderBallX !== null &&
        prevRenderBallY !== null &&
        dtSeconds > 0
      ) {
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
        (now - ballSquashStart) / BALL_SQUASH_DURATION_MS,
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
        (now - paddleLeftSquashStart) / PADDLE_SQUASH_DURATION_MS,
        0,
        1,
      );
      const rightSquashProgress = clamp(
        (now - paddleRightSquashStart) / PADDLE_SQUASH_DURATION_MS,
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
      paddleLeftGlow.alpha = paddleGlowAlpha(now, 0, paddleLeftFlashStart);
      paddleRightGlow.alpha = paddleGlowAlpha(
        now,
        Math.PI,
        paddleRightFlashStart,
      );

      paddleLeftFlash.position.y = leftCenterY;
      paddleRightFlash.position.y = rightCenterY;
      paddleLeftFlash.alpha = paddleFlashAlpha(now, paddleLeftFlashStart);
      paddleRightFlash.alpha = paddleFlashAlpha(now, paddleRightFlashStart);

      updatePaddleTrail(leftTrailPoints, leftCenterY, leftVelocity, dtMs);
      updatePaddleTrail(rightTrailPoints, rightCenterY, rightVelocity, dtMs);
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

  function dispose() {
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
    if (initialized) {
      if (tick) app.ticker.remove(tick);
      app.destroy({ removeView: false });
    }
  }

  function paddleHit(
    side: Side,
    x: number,
    y: number,
    ballSpeed: number,
    at: number,
  ) {
    spawnHitParticles(side, x, y, ballSpeed);
    ballSquashStart = at;
    if (side === 'left') {
      paddleLeftSquashStart = at;
      paddleLeftFlashStart = at;
    } else {
      paddleRightSquashStart = at;
      paddleRightFlashStart = at;
    }
    shakeStart = at;
    shakeMagnitude = clamp(
      SHAKE_MAGNITUDE_MAX * (ballSpeed / BALL_SPEED_REFERENCE),
      SHAKE_MAGNITUDE_MIN,
      SHAKE_MAGNITUDE_MAX,
    );
  }

  return { paddleHit, dispose };
}
