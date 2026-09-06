export type PaddleSide = 'left' | 'right';
export type PaddleInput = -1 | 0 | 1;

export interface PongEngineConfig {
  width?: number;
  height?: number;
  paddleHeight?: number;
  paddleWidth?: number;
  paddleSpeed?: number;
  ballRadius?: number;
  ballSpeed?: number;
  winningScore?: number;
  paddleHitAcceleration?: number;
  paddleSpinFactor?: number;
  maxBallSpeed?: number;
  maxBounceAngleDeg?: number;
  minHorizontalSpeedRatio?: number;
  cornerGap?: number;
  maxServeAngleDeg?: number;
  pointPauseMs?: number;
  serveDelayMs?: number;
}

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface PongState {
  width: number;
  height: number;
  ball: Ball;
  paddles: { left: number; right: number };
  score: { left: number; right: number };
  winner: PaddleSide | null;
  phase: 'serving' | 'rally' | 'point-scored' | 'game-over';
  phaseRemainingMs: number;
  lastScorer: PaddleSide | null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

const PADDLE_SIDES = ['left', 'right'] as const;

export class PongEngine {
  private readonly config: Required<PongEngineConfig>;
  private state: PongState;
  private input: { left: PaddleInput; right: PaddleInput } = {
    left: 0,
    right: 0,
  };
  private target: { left: number | null; right: number | null } = {
    left: null,
    right: null,
  };
  private serveTarget: PaddleSide = 'right';

  constructor(
    config: PongEngineConfig = {},
    private readonly rng: () => number = Math.random,
  ) {
    const ballSpeed = config.ballSpeed ?? 300;
    this.config = {
      width: config.width ?? 800,
      height: config.height ?? 480,
      paddleHeight: config.paddleHeight ?? 80,
      paddleWidth: config.paddleWidth ?? 12,
      paddleSpeed: config.paddleSpeed ?? 400,
      ballRadius: config.ballRadius ?? 8,
      ballSpeed,
      winningScore: config.winningScore ?? 5,
      paddleHitAcceleration: config.paddleHitAcceleration ?? 1.05,
      paddleSpinFactor: config.paddleSpinFactor ?? 0.3,
      // Otherwise paddleHitAcceleration compounds every hit with nothing to
      // stop it: a long rally eventually moves the ball further in one tick
      // than the paddle is wide, which the collision check can't see past.
      maxBallSpeed: config.maxBallSpeed ?? ballSpeed * 2.5,
      maxBounceAngleDeg: config.maxBounceAngleDeg ?? 60,
      minHorizontalSpeedRatio: config.minHorizontalSpeedRatio ?? 0.25,
      cornerGap: config.cornerGap ?? (config.height ?? 480) * 0.03,
      maxServeAngleDeg: config.maxServeAngleDeg ?? 25,
      pointPauseMs: config.pointPauseMs ?? 0,
      serveDelayMs: config.serveDelayMs ?? 0,
    };
    this.state = this.initState();
  }

  reset() {
    this.input = { left: 0, right: 0 };
    this.target = { left: null, right: null };
    this.serveTarget = 'right';
    this.state = this.initState();
  }

  forceWinner(side: PaddleSide) {
    if (this.state.winner) return;
    this.state.winner = side;
    this.state.phase = 'game-over';
    this.state.phaseRemainingMs = 0;
  }

  private initState(): PongState {
    return {
      width: this.config.width,
      height: this.config.height,
      ball: this.servingBall('right'),
      paddles: {
        left: (this.config.height - this.config.paddleHeight) / 2,
        right: (this.config.height - this.config.paddleHeight) / 2,
      },
      score: { left: 0, right: 0 },
      winner: null,
      phase: this.config.serveDelayMs > 0 ? 'serving' : 'rally',
      phaseRemainingMs: this.config.serveDelayMs,
      lastScorer: null,
    };
  }

  getConfig(): Readonly<Required<PongEngineConfig>> {
    return this.config;
  }

  getState(): PongState {
    return {
      width: this.state.width,
      height: this.state.height,
      ball: { ...this.state.ball },
      paddles: { ...this.state.paddles },
      score: { ...this.state.score },
      winner: this.state.winner,
      phase: this.state.phase,
      phaseRemainingMs: this.state.phaseRemainingMs,
      lastScorer: this.state.lastScorer,
    };
  }

  setInput(side: PaddleSide, direction: PaddleInput) {
    this.input[side] = direction;
    this.target[side] = null;
  }

  setTarget(side: PaddleSide, target: number) {
    this.target[side] = clamp(target, 0, 1);
  }

  tick(dtMs: number) {
    if (this.state.winner) return;
    if (!this.advancePhase(dtMs)) return;
    const dt = dtMs / 1000;

    this.movePaddles(dt);
    const ballOrigin = { x: this.state.ball.x, y: this.state.ball.y };
    this.moveBall(dt);
    this.handleWallBounce();
    this.handlePaddleCollision('left', ballOrigin);
    this.handlePaddleCollision('right', ballOrigin);
    this.handleScoring();
  }

  private advancePhase(dtMs: number): boolean {
    if (this.state.phase === 'rally') return true;
    this.state.phaseRemainingMs = Math.max(
      0,
      this.state.phaseRemainingMs - dtMs,
    );
    if (this.state.phaseRemainingMs > 0) return false;
    if (this.state.phase === 'point-scored') {
      this.state.ball = this.servingBall(this.serveTarget);
      this.state.phase = this.config.serveDelayMs > 0 ? 'serving' : 'rally';
      this.state.phaseRemainingMs = this.config.serveDelayMs;
      return this.state.phase === 'rally';
    }
    if (this.state.phase === 'serving') {
      this.state.phase = 'rally';
      return true;
    }
    return false;
  }

  private movePaddles(dt: number) {
    for (const side of PADDLE_SIDES) {
      const min = this.config.cornerGap;
      const max =
        this.config.height - this.config.paddleHeight - this.config.cornerGap;
      const target = this.target[side];
      let next: number;
      if (target === null) {
        next =
          this.state.paddles[side] +
          this.input[side] * this.config.paddleSpeed * dt;
      } else {
        const desired = min + target * (max - min);
        const delta = desired - this.state.paddles[side];
        const maxStep = this.config.paddleSpeed * dt;
        next = this.state.paddles[side] + clamp(delta, -maxStep, maxStep);
      }
      this.state.paddles[side] = clamp(next, min, max);
    }
  }

  private moveBall(dt: number) {
    this.state.ball.x += this.state.ball.vx * dt;
    this.state.ball.y += this.state.ball.vy * dt;
  }

  private handleWallBounce() {
    const r = this.config.ballRadius;
    if (this.state.ball.y - r <= 0) {
      this.state.ball.y = r;
      this.state.ball.vy = Math.abs(this.state.ball.vy);
    } else if (this.state.ball.y + r >= this.config.height) {
      this.state.ball.y = this.config.height - r;
      this.state.ball.vy = -Math.abs(this.state.ball.vy);
    }
  }

  private handlePaddleCollision(
    side: PaddleSide,
    ballOrigin: { x: number; y: number },
  ) {
    const r = this.config.ballRadius;
    const paddleY = this.state.paddles[side];
    const paddleX =
      side === 'left'
        ? this.config.paddleWidth
        : this.config.width - this.config.paddleWidth;

    const withinX =
      side === 'left'
        ? this.state.ball.x - r <= paddleX
        : this.state.ball.x + r >= paddleX;
    const movingToward =
      side === 'left' ? this.state.ball.vx < 0 : this.state.ball.vx > 0;
    if (!withinX || !movingToward) return;

    // A fast-enough ball can cross the paddle's whole plane within one
    // tick, so checking the y-range at wherever the tick left the ball can
    // miss a real hit (or register one that never happened). Interpolate
    // the y it actually had at the moment its path crossed the paddle's
    // x-plane instead.
    const dx = this.state.ball.x - ballOrigin.x;
    const crossT = dx !== 0 ? clamp((paddleX - ballOrigin.x) / dx, 0, 1) : 1;
    const impactY = ballOrigin.y + (this.state.ball.y - ballOrigin.y) * crossT;

    const withinY =
      impactY >= paddleY && impactY <= paddleY + this.config.paddleHeight;
    if (!withinY) return;

    const incomingSpeed = Math.hypot(this.state.ball.vx, this.state.ball.vy);
    const outgoingSpeed = Math.min(
      incomingSpeed * this.config.paddleHitAcceleration,
      this.config.maxBallSpeed,
    );
    const paddleCenter = paddleY + this.config.paddleHeight / 2;
    const rawOffset = (impactY - paddleCenter) / (this.config.paddleHeight / 2);
    const spinOffset = this.input[side] * this.config.paddleSpinFactor * 0.25;
    const offset = clamp(rawOffset + spinOffset, -1, 1);
    const angle = offset * ((this.config.maxBounceAngleDeg * Math.PI) / 180);
    const direction = side === 'left' ? 1 : -1;
    let vx = direction * outgoingSpeed * Math.cos(angle);
    let vy = outgoingSpeed * Math.sin(angle);
    const minimumHorizontal =
      outgoingSpeed * this.config.minHorizontalSpeedRatio;
    if (Math.abs(vx) < minimumHorizontal) {
      vx = direction * minimumHorizontal;
      const verticalMagnitude = Math.sqrt(
        Math.max(0, outgoingSpeed ** 2 - minimumHorizontal ** 2),
      );
      vy = Math.sign(vy || offset || 1) * verticalMagnitude;
    }
    this.state.ball.vx = vx;
    this.state.ball.vy = vy;
    this.state.ball.x = side === 'left' ? paddleX + r : paddleX - r;
    this.state.ball.y = impactY;
  }

  private handleScoring() {
    if (this.state.ball.x < 0) {
      this.score('right');
    } else if (this.state.ball.x > this.config.width) {
      this.score('left');
    }
  }

  private score(side: PaddleSide) {
    this.state.score[side] += 1;
    this.state.lastScorer = side;
    if (this.state.score[side] >= this.config.winningScore) {
      this.state.winner = side;
      this.state.phase = 'game-over';
      this.state.phaseRemainingMs = 0;
      return;
    }
    this.serveTarget = side === 'left' ? 'right' : 'left';
    this.state.ball = {
      x: this.config.width / 2,
      y: this.config.height / 2,
      vx: 0,
      vy: 0,
    };
    this.state.phase = 'point-scored';
    this.state.phaseRemainingMs = this.config.pointPauseMs;
    if (this.config.pointPauseMs === 0) this.advancePhase(0);
  }

  private servingBall(servingTo: PaddleSide): Ball {
    const maxAngle = (this.config.maxServeAngleDeg * Math.PI) / 180;
    const angle = (this.rng() * 2 - 1) * maxAngle;
    const direction = servingTo === 'right' ? 1 : -1;
    const vy = this.config.ballSpeed * Math.sin(angle);
    return {
      x: this.config.width / 2,
      y: this.config.height / 2,
      vx: direction * this.config.ballSpeed * Math.cos(angle),
      vy: Math.abs(vy) < Number.EPSILON ? 0 : vy,
    };
  }
}
