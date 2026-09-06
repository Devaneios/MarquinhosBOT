import {
  getPongRuleset,
  normalizePongMatchConfig,
} from 'services/activity/pong/PongRulesetRegistry';
import type {
  PongBallState,
  PongBrickState,
  PongEngineEvent,
  PongEngineState,
  PongInputState,
  PongMatchConfig,
  PongPaddleState,
  PongPowerUpKind,
  PongRulesetId,
  PongSide,
} from 'services/activity/pong/PongTypes';

export interface PongArenaEngineConfig extends Partial<
  Omit<PongMatchConfig, 'ruleset'>
> {
  ruleset: PongRulesetId;
  width?: number;
  height?: number;
  paddleSpeed?: number;
  ballSpeed?: number;
  maxBallSpeed?: number;
  cornerGap?: number;
}

interface ActiveEffect {
  kind: PongPowerUpKind;
  paddleId: number;
  untilMs: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function seededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function circleRect(ball: PongBallState, rect: PongBrickState): boolean {
  const x = clamp(ball.x, rect.x, rect.x + rect.width);
  const y = clamp(ball.y, rect.y, rect.y + rect.height);
  const dx = ball.x - x;
  const dy = ball.y - y;
  return dx * dx + dy * dy <= ball.radius * ball.radius;
}

function paddleRect(paddle: PongPaddleState): PongBrickState {
  return {
    id: paddle.id,
    x: paddle.x,
    y: paddle.y,
    width: paddle.width * paddle.sizeMultiplier,
    height: paddle.height * paddle.sizeMultiplier,
    hp: 1,
    active: paddle.active,
  };
}

export class PongArenaEngine {
  private readonly matchConfig: PongMatchConfig;
  private readonly width: number;
  private readonly height: number;
  private readonly paddleSpeed: number;
  private readonly ballSpeed: number;
  private readonly maxBallSpeed: number;
  private readonly cornerGap: number;
  private readonly rng: () => number;
  private state: PongEngineState;
  private inputs = new Map<number, PongInputState>();
  private events: PongEngineEvent[] = [];
  private effects: ActiveEffect[] = [];
  private nextPowerUpAtMs = 8000;
  private nextEntityId = 1000;

  constructor(config: PongArenaEngineConfig) {
    this.matchConfig = normalizePongMatchConfig({
      ruleset: config.ruleset,
      ...(config.targetScore !== undefined
        ? { targetScore: config.targetScore }
        : {}),
      ...(config.bestOf !== undefined ? { bestOf: config.bestOf } : {}),
      ...(config.ranked !== undefined ? { ranked: config.ranked } : {}),
      ...(config.lives !== undefined ? { lives: config.lives } : {}),
      ...(config.maxBalls !== undefined ? { maxBalls: config.maxBalls } : {}),
      ...(config.powerUps !== undefined ? { powerUps: config.powerUps } : {}),
      ...(config.disconnectReplacement !== undefined
        ? { disconnectReplacement: config.disconnectReplacement }
        : {}),
      ...(config.seed !== undefined ? { seed: config.seed } : {}),
    });
    this.width = config.width ?? 800;
    this.height = config.height ?? 480;
    this.paddleSpeed = config.paddleSpeed ?? 400;
    this.ballSpeed = config.ballSpeed ?? 300;
    this.maxBallSpeed = config.maxBallSpeed ?? this.ballSpeed * 2.5;
    this.cornerGap = config.cornerGap ?? this.height * 0.03;
    this.rng = seededRandom(this.matchConfig.seed);
    this.state = this.createInitialState();
  }

  getConfig() {
    return {
      ...this.matchConfig,
      width: this.width,
      height: this.height,
      paddleSpeed: this.paddleSpeed,
      ballSpeed: this.ballSpeed,
      maxBallSpeed: this.maxBallSpeed,
      cornerGap: this.cornerGap,
    };
  }

  getState(): PongEngineState {
    return {
      ...this.state,
      balls: this.state.balls.map((ball) => ({ ...ball })),
      paddles: this.state.paddles.map((paddle) => ({ ...paddle })),
      bricks: this.state.bricks.map((brick) => ({ ...brick })),
      powerUps: this.state.powerUps.map((powerUp) => ({ ...powerUp })),
      score: [...this.state.score],
      lives: [...this.state.lives],
      gamesWon: [...this.state.gamesWon],
      placements: [...this.state.placements],
    };
  }

  consumeEvents(): PongEngineEvent[] {
    const events = this.events;
    this.events = [];
    return events;
  }

  setInput(slot: number, input: PongInputState): void {
    if (!Number.isInteger(slot) || slot < 0 || slot > 3) return;
    this.inputs.set(slot, {
      axis: input.axis,
      target:
        input.target === null || !Number.isFinite(input.target)
          ? null
          : clamp(input.target, 0, 1),
      release: input.release,
    });
  }

  forceWinner(slot: number): void {
    if (this.state.winnerSlot !== null) return;
    this.state.winnerSlot = slot;
    this.state.winnerTeam =
      this.state.paddles.find((paddle) => paddle.slot === slot)?.team ?? null;
    this.state.phase = 'series-over';
    this.state.phaseRemainingMs = 0;
    this.emit('series-won', slot, null, null);
  }

  setSlotActive(slot: number, active: boolean): void {
    for (const paddle of this.state.paddles) {
      if (paddle.slot === slot) paddle.active = active;
    }
  }

  setNoContest(): void {
    this.state.phase = 'no-contest';
    this.state.phaseRemainingMs = 0;
    for (const ball of this.state.balls) ball.active = false;
  }

  reset(): void {
    this.inputs.clear();
    this.events = [];
    this.effects = [];
    this.nextPowerUpAtMs = 8000;
    this.nextEntityId = 1000;
    this.state = this.createInitialState();
  }

  begin(): void {
    if (this.state.elapsedMs !== 0 || this.state.phase !== 'rally') return;
    this.state.phase = 'countdown';
    this.state.phaseRemainingMs = 1200;
    this.centerBalls();
  }

  tick(dtMs: number): void {
    if (dtMs <= 0 || !Number.isFinite(dtMs)) return;
    this.state.elapsedMs += dtMs;
    this.updateEffects();
    this.movePaddles(dtMs);
    if (this.state.phase !== 'rally') {
      this.advancePhase(dtMs);
      this.maybeSpawnPowerUp();
      return;
    }
    for (const ball of this.state.balls) {
      if (!ball.active || ball.stickyPaddleId !== null) continue;
      this.integrateBall(ball, dtMs);
      this.handlePaddles(ball);
      this.handleBricks(ball);
      this.handlePowerUps(ball);
      this.handleArena(ball);
    }
    if (
      this.matchConfig.ruleset === 'coop-keep-alive' ||
      this.matchConfig.ruleset === 'radial-solo'
    ) {
      this.state.score[0] = Math.floor(this.state.elapsedMs / 1000);
    }
    this.maybeSpawnPowerUp();
    this.checkCompletion();
  }

  private createInitialState(): PongEngineState {
    const definition = getPongRuleset(this.matchConfig.ruleset);
    const paddles = this.createPaddles();
    const slotCount = Math.max(
      definition.maxPlayers,
      paddles.reduce((max, paddle) => Math.max(max, paddle.slot + 1), 0),
    );
    return {
      width: this.width,
      height: this.height,
      ruleset: this.matchConfig.ruleset,
      arena: definition.arena,
      phase: 'rally',
      phaseRemainingMs: 0,
      elapsedMs: 0,
      balls: this.createBalls(),
      paddles,
      bricks: this.createBricks(),
      powerUps: [],
      score: Array.from({ length: Math.max(2, slotCount) }, () => 0),
      lives: Array.from({ length: slotCount }, () =>
        this.matchConfig.ruleset === 'quad-elimination'
          ? this.matchConfig.lives
          : 0,
      ),
      gamesWon: Array.from({ length: Math.max(2, slotCount) }, () => 0),
      gameIndex: 0,
      rallyHits: 0,
      winnerSlot: null,
      winnerTeam: null,
      placements: Array.from({ length: slotCount }, () => 0),
      lastEventSeq: 0,
    };
  }

  private createPaddles(): PongPaddleState[] {
    const ruleset = this.matchConfig.ruleset;
    const paddles: PongPaddleState[] = [];
    const vertical = (
      id: number,
      slot: number,
      team: number,
      side: 'left' | 'right',
      depth = 0,
    ) => {
      const width = 12;
      const height = 80;
      const x =
        side === 'left'
          ? 12 + depth * 24
          : this.width - width - 12 - depth * 24;
      paddles.push(
        this.paddle(
          id,
          slot,
          team,
          side,
          x,
          (this.height - height) / 2,
          width,
          height,
        ),
      );
    };
    const horizontal = (
      id: number,
      slot: number,
      team: number,
      side: 'top' | 'bottom',
      x = (this.width - 80) / 2,
    ) => {
      const width = 80;
      const height = 12;
      const y = side === 'top' ? 12 : this.height - height - 12;
      paddles.push(this.paddle(id, slot, team, side, x, y, width, height));
    };

    if (ruleset === 'breakout') {
      horizontal(0, 0, 0, 'bottom');
    } else if (ruleset === 'rebound') {
      horizontal(0, 0, 0, 'bottom', this.width * 0.2 - 40);
      horizontal(1, 1, 1, 'bottom', this.width * 0.8 - 40);
    } else if (ruleset === 'radial-solo' || ruleset === 'radial-duel') {
      const count = ruleset === 'radial-solo' ? 1 : 2;
      for (let slot = 0; slot < count; slot += 1) {
        const paddle = this.paddle(
          slot,
          slot,
          slot,
          slot === 0 ? 'bottom' : 'top',
          this.width / 2,
          this.height / 2,
          12,
          80,
        );
        paddle.orientation = 'radial';
        paddle.angle = slot === 0 ? Math.PI / 2 : -Math.PI / 2;
        paddle.arc = Math.PI / 3;
        paddle.axisPosition = paddle.angle;
        paddles.push(paddle);
      }
    } else if (
      ruleset === 'quad-elimination' ||
      ruleset === 'air-hockey' ||
      ruleset === 'coop-keep-alive'
    ) {
      vertical(0, 0, 0, 'left');
      vertical(1, 1, 1, 'right');
      horizontal(2, 2, 2, 'top');
      horizontal(3, 3, 3, 'bottom');
    } else if (ruleset === 'doubles-2v2') {
      vertical(0, 0, 0, 'left', 0);
      vertical(1, 1, 0, 'left', 1);
      vertical(2, 2, 1, 'right', 0);
      vertical(3, 3, 1, 'right', 1);
    } else if (ruleset === 'superpong') {
      vertical(0, 0, 0, 'left', 0);
      vertical(1, 0, 0, 'left', 1);
      vertical(2, 1, 1, 'right', 0);
      vertical(3, 1, 1, 'right', 1);
    } else {
      vertical(0, 0, 0, 'left');
      vertical(1, 1, 1, 'right');
    }
    return paddles;
  }

  private paddle(
    id: number,
    slot: number,
    team: number,
    side: PongSide,
    x: number,
    y: number,
    width: number,
    height: number,
  ): PongPaddleState {
    return {
      id,
      slot,
      team,
      side,
      orientation:
        side === 'left' || side === 'right' ? 'vertical' : 'horizontal',
      x,
      y,
      width,
      height,
      angle: 0,
      arc: 0,
      axisPosition: side === 'left' || side === 'right' ? y : x,
      velocity: 0,
      sizeMultiplier: 1,
      speedMultiplier: 1,
      shield: 0,
      reversedUntilMs: 0,
      stickyUntilMs: 0,
      active: true,
    };
  }

  private createBalls(): PongBallState[] {
    const count = this.matchConfig.ruleset === 'multiball' ? 3 : 1;
    return Array.from({ length: count }, (_, id) => this.servingBall(id, id));
  }

  private servingBall(id: number, angleIndex = 0): PongBallState {
    const spread = angleIndex === 0 ? 0 : angleIndex % 2 === 0 ? 0.22 : -0.22;
    const randomAngle = (this.rng() * 2 - 1) * 0.35 + spread;
    return {
      id,
      x: this.width / 2,
      y: this.height / 2,
      vx: this.ballSpeed * Math.cos(randomAngle),
      vy: this.ballSpeed * Math.sin(randomAngle),
      radius: 8,
      spin: 0,
      lastTouchSlot: null,
      stickyPaddleId: null,
      active: true,
    };
  }

  private createBricks(): PongBrickState[] {
    const ruleset = this.matchConfig.ruleset;
    if (ruleset !== 'breakout' && ruleset !== 'brick-battle') return [];
    const rows = ruleset === 'breakout' ? 6 : 2;
    const columns = ruleset === 'breakout' ? 10 : 8;
    const width = ruleset === 'breakout' ? 56 : 52;
    const height = 18;
    const gap = 6;
    const total = columns * width + (columns - 1) * gap;
    const startX = (this.width - total) / 2;
    const startY = ruleset === 'breakout' ? 50 : this.height / 2 - 24;
    const bricks: PongBrickState[] = [];
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        bricks.push({
          id: row * columns + column,
          x: startX + column * (width + gap),
          y: startY + row * (height + gap),
          width,
          height,
          hp: 1,
          active: true,
        });
      }
    }
    return bricks;
  }

  private movePaddles(dtMs: number): void {
    for (const paddle of this.state.paddles) {
      if (!paddle.active) continue;
      const input = this.inputs.get(paddle.slot) ?? {
        axis: 0,
        target: null,
        release: false,
      };
      if (input.release) this.releaseSticky(paddle);
      const reversed = paddle.reversedUntilMs > this.state.elapsedMs;
      const axis = reversed ? (-input.axis as -1 | 0 | 1) : input.axis;
      const target =
        input.target === null
          ? null
          : reversed
            ? 1 - input.target
            : input.target;
      const speed = this.paddleSpeed * paddle.speedMultiplier;
      const previous = paddle.axisPosition;
      if (paddle.orientation === 'radial') {
        const desired = target === null ? null : target * Math.PI * 2 - Math.PI;
        const delta =
          desired === null ? axis * speed * 0.003 : desired - paddle.angle;
        paddle.angle += clamp(
          delta,
          -speed * (dtMs / 1000) * 0.01,
          speed * (dtMs / 1000) * 0.01,
        );
        paddle.axisPosition = paddle.angle;
      } else {
        const vertical = paddle.orientation === 'vertical';
        const length = vertical
          ? paddle.height * paddle.sizeMultiplier
          : paddle.width * paddle.sizeMultiplier;
        const boundary = vertical ? this.height : this.width;
        const min = this.cornerGap;
        const max = boundary - length - this.cornerGap;
        const desired = target === null ? null : min + target * (max - min);
        const maxStep = speed * (dtMs / 1000);
        paddle.axisPosition = clamp(
          desired === null
            ? paddle.axisPosition + axis * maxStep
            : paddle.axisPosition +
                clamp(desired - paddle.axisPosition, -maxStep, maxStep),
          min,
          max,
        );
        if (vertical) paddle.y = paddle.axisPosition;
        else paddle.x = paddle.axisPosition;
      }
      paddle.velocity = (paddle.axisPosition - previous) / (dtMs / 1000);
    }
  }

  private integrateBall(ball: PongBallState, dtMs: number): void {
    const dt = dtMs / 1000;
    if (
      this.matchConfig.ruleset === 'rebound' ||
      this.matchConfig.ruleset === 'pong-tennis'
    ) {
      ball.vy += 420 * dt;
    }
    if (this.matchConfig.ruleset === 'pong-tennis') {
      ball.vx += ball.spin * 12 * dt;
      ball.vy -= ball.spin * ball.vx * 0.002 * dt;
    }
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
  }

  private handlePaddles(ball: PongBallState): void {
    if (this.state.arena === 'circular') {
      this.handleRadialPaddles(ball);
      return;
    }
    for (const paddle of this.state.paddles) {
      if (!paddle.active || !circleRect(ball, paddleRect(paddle))) continue;
      const movingToward =
        paddle.side === 'left'
          ? ball.vx < 0
          : paddle.side === 'right'
            ? ball.vx > 0
            : paddle.side === 'top'
              ? ball.vy < 0
              : ball.vy > 0;
      if (!movingToward) continue;
      this.bounceFromPaddle(ball, paddle);
      if (paddle.stickyUntilMs > this.state.elapsedMs) {
        ball.stickyPaddleId = paddle.id;
        ball.vx = 0;
        ball.vy = 0;
      }
      this.state.rallyHits += 1;
      ball.lastTouchSlot = paddle.slot;
      this.emit('paddle-hit', paddle.slot, paddle.id, ball.id);
      break;
    }
  }

  private bounceFromPaddle(ball: PongBallState, paddle: PongPaddleState): void {
    const vertical = paddle.orientation === 'vertical';
    const rect = paddleRect(paddle);
    const center = vertical
      ? rect.y + rect.height / 2
      : rect.x + rect.width / 2;
    const impact = vertical ? ball.y : ball.x;
    const length = vertical ? rect.height : rect.width;
    const offset = clamp((impact - center) / (length / 2), -1, 1);
    const speed = Math.min(
      Math.max(this.ballSpeed, Math.hypot(ball.vx, ball.vy) * 1.05),
      this.maxBallSpeed,
    );
    const angle = offset * (Math.PI / 3);
    if (paddle.side === 'left' || paddle.side === 'right') {
      const direction = paddle.side === 'left' ? 1 : -1;
      ball.vx = direction * Math.max(speed * 0.25, speed * Math.cos(angle));
      ball.vy = speed * Math.sin(angle) + paddle.velocity * 0.12;
      ball.x =
        paddle.side === 'left'
          ? rect.x + rect.width + ball.radius
          : rect.x - ball.radius;
    } else {
      const direction = paddle.side === 'top' ? 1 : -1;
      ball.vy = direction * Math.max(speed * 0.25, speed * Math.cos(angle));
      ball.vx = speed * Math.sin(angle) + paddle.velocity * 0.12;
      ball.y =
        paddle.side === 'top'
          ? rect.y + rect.height + ball.radius
          : rect.y - ball.radius;
    }
    ball.spin = paddle.velocity / Math.max(1, this.paddleSpeed);
    this.capBall(ball);
  }

  private handleRadialPaddles(ball: PongBallState): void {
    const cx = this.width / 2;
    const cy = this.height / 2;
    const dx = ball.x - cx;
    const dy = ball.y - cy;
    const radius = Math.min(this.width, this.height) * 0.46;
    const distance = Math.hypot(dx, dy);
    if (distance + ball.radius < radius) return;
    const angle = Math.atan2(dy, dx);
    const paddle = this.state.paddles.find(
      (candidate) =>
        candidate.active &&
        Math.abs(this.angleDelta(angle, candidate.angle)) <= candidate.arc / 2,
    );
    if (!paddle) return;
    const nx = dx / Math.max(distance, 1);
    const ny = dy / Math.max(distance, 1);
    const dot = ball.vx * nx + ball.vy * ny;
    ball.vx -= 2 * dot * nx;
    ball.vy -= 2 * dot * ny;
    ball.x = cx + nx * (radius - ball.radius);
    ball.y = cy + ny * (radius - ball.radius);
    ball.lastTouchSlot = paddle.slot;
    this.state.rallyHits += 1;
    this.emit('paddle-hit', paddle.slot, paddle.id, ball.id);
  }

  private handleBricks(ball: PongBallState): void {
    for (const brick of this.state.bricks) {
      if (!brick.active || !circleRect(ball, brick)) continue;
      brick.hp -= 1;
      if (brick.hp <= 0) {
        brick.active = false;
        this.emit('brick-destroyed', ball.lastTouchSlot, brick.id, null);
      }
      const centerX = brick.x + brick.width / 2;
      const centerY = brick.y + brick.height / 2;
      if (
        Math.abs(ball.x - centerX) / brick.width >
        Math.abs(ball.y - centerY) / brick.height
      ) {
        ball.vx *= -1;
      } else {
        ball.vy *= -1;
      }
      if (this.matchConfig.ruleset === 'breakout') {
        const cleared = this.state.bricks.filter((item) => !item.active).length;
        const scale = 1 + (cleared / this.state.bricks.length) * 0.8;
        this.setBallSpeed(
          ball,
          Math.min(this.maxBallSpeed, this.ballSpeed * scale),
        );
      }
      break;
    }
  }

  private handlePowerUps(ball: PongBallState): void {
    for (const powerUp of this.state.powerUps) {
      if (!powerUp.active) continue;
      const dx = ball.x - powerUp.x;
      const dy = ball.y - powerUp.y;
      if (dx * dx + dy * dy > (ball.radius + powerUp.radius) ** 2) continue;
      powerUp.active = false;
      const paddle =
        this.state.paddles.find((item) => item.slot === ball.lastTouchSlot) ??
        this.state.paddles[0];
      if (paddle) this.applyPowerUp(powerUp.kind, paddle);
      this.emit('powerup-collected', paddle?.slot ?? null, powerUp.id, null);
    }
  }

  private handleArena(ball: PongBallState): void {
    if (this.state.arena === 'circular') {
      this.handleCircularExit(ball);
      return;
    }
    if (this.state.arena === 'volleyball') {
      this.handleVolleyball(ball);
      return;
    }
    if (this.state.arena === 'breakout') {
      this.handleBreakoutBounds(ball);
      return;
    }
    if (this.state.arena === 'square' || this.state.arena === 'air-hockey') {
      this.handleFourSideBounds(ball);
      return;
    }
    if (ball.y - ball.radius <= 0) {
      ball.y = ball.radius;
      ball.vy = Math.abs(ball.vy);
      this.emit('wall-hit', null, ball.id, null);
    } else if (ball.y + ball.radius >= this.height) {
      ball.y = this.height - ball.radius;
      ball.vy = -Math.abs(ball.vy);
      this.emit('wall-hit', null, ball.id, null);
    }
    if (ball.x < -ball.radius) this.concedeSide('left', ball);
    else if (ball.x > this.width + ball.radius) this.concedeSide('right', ball);
  }

  private handleFourSideBounds(ball: PongBallState): void {
    const corner = Math.min(this.width, this.height) * 0.08;
    const nearHorizontalCorner =
      ball.y < corner || ball.y > this.height - corner;
    const nearVerticalCorner = ball.x < corner || ball.x > this.width - corner;
    if ((ball.x < 0 || ball.x > this.width) && nearHorizontalCorner) {
      ball.vx *= -1;
      ball.x = clamp(ball.x, ball.radius, this.width - ball.radius);
      return;
    }
    if ((ball.y < 0 || ball.y > this.height) && nearVerticalCorner) {
      ball.vy *= -1;
      ball.y = clamp(ball.y, ball.radius, this.height - ball.radius);
      return;
    }
    if (ball.x < -ball.radius) this.concedeSide('left', ball);
    else if (ball.x > this.width + ball.radius) this.concedeSide('right', ball);
    else if (ball.y < -ball.radius) this.concedeSide('top', ball);
    else if (ball.y > this.height + ball.radius)
      this.concedeSide('bottom', ball);
  }

  private handleVolleyball(ball: PongBallState): void {
    if (ball.x - ball.radius <= 0) {
      ball.x = ball.radius;
      ball.vx = Math.abs(ball.vx);
    } else if (ball.x + ball.radius >= this.width) {
      ball.x = this.width - ball.radius;
      ball.vx = -Math.abs(ball.vx);
    }
    if (ball.y - ball.radius <= 0) {
      ball.y = ball.radius;
      ball.vy = Math.abs(ball.vy);
    }
    const net = {
      id: -1,
      x: this.width / 2 - 6,
      y: this.height * 0.58,
      width: 12,
      height: this.height * 0.42,
      hp: 1,
      active: true,
    };
    if (circleRect(ball, net)) {
      ball.vx *= -1;
      ball.x =
        ball.x < this.width / 2
          ? net.x - ball.radius
          : net.x + net.width + ball.radius;
    }
    if (ball.y > this.height + ball.radius) {
      this.scoreTeam(ball.x < this.width / 2 ? 1 : 0, ball);
    }
  }

  private handleBreakoutBounds(ball: PongBallState): void {
    if (ball.x - ball.radius <= 0) {
      ball.x = ball.radius;
      ball.vx = Math.abs(ball.vx);
    } else if (ball.x + ball.radius >= this.width) {
      ball.x = this.width - ball.radius;
      ball.vx = -Math.abs(ball.vx);
    }
    if (ball.y - ball.radius <= 0) {
      ball.y = ball.radius;
      ball.vy = Math.abs(ball.vy);
      const paddle = this.state.paddles[0];
      if (paddle) this.applyPowerUp('shrink', paddle);
    }
    if (ball.y > this.height + ball.radius) {
      this.endCooperativeRound(ball);
    }
  }

  private handleCircularExit(ball: PongBallState): void {
    const dx = ball.x - this.width / 2;
    const dy = ball.y - this.height / 2;
    const radius = Math.min(this.width, this.height) * 0.46;
    if (Math.hypot(dx, dy) <= radius + ball.radius) return;
    if (this.matchConfig.ruleset === 'radial-solo') {
      this.endCooperativeRound(ball);
      return;
    }
    const angle = Math.atan2(dy, dx);
    const losingSlot = Math.cos(angle) >= 0 ? 1 : 0;
    this.scoreTeam(losingSlot === 0 ? 1 : 0, ball);
  }

  private concedeSide(side: PongSide, ball: PongBallState): void {
    const paddle = this.state.paddles.find((item) => item.side === side);
    if (
      paddle &&
      !paddle.active &&
      this.matchConfig.ruleset === 'quad-elimination'
    ) {
      if (side === 'left' || side === 'right') ball.vx *= -1;
      else ball.vy *= -1;
      ball.x = clamp(ball.x, ball.radius, this.width - ball.radius);
      ball.y = clamp(ball.y, ball.radius, this.height - ball.radius);
      return;
    }
    if (this.matchConfig.ruleset === 'coop-keep-alive') {
      this.endCooperativeRound(ball);
      return;
    }
    if (this.matchConfig.ruleset === 'quad-elimination') {
      if (paddle) this.loseLife(paddle.slot, ball);
      return;
    }
    if (this.matchConfig.ruleset === 'air-hockey') {
      const team = paddle ? (paddle.team + 1) % 4 : 0;
      this.scoreTeam(team, ball);
      return;
    }
    const team = side === 'left' ? 1 : 0;
    const defending = this.state.paddles.find((item) => item.side === side);
    if (defending?.shield) {
      defending.shield -= 1;
      if (side === 'left') ball.vx = Math.abs(ball.vx);
      else ball.vx = -Math.abs(ball.vx);
      ball.x = clamp(ball.x, ball.radius, this.width - ball.radius);
      return;
    }
    this.scoreTeam(team, ball);
  }

  private scoreTeam(team: number, ball: PongBallState): void {
    this.state.score[team] = (this.state.score[team] ?? 0) + 1;
    this.emit('point-scored', null, ball.id, team);
    if ((this.state.score[team] ?? 0) >= this.matchConfig.targetScore) {
      this.state.gamesWon[team] = (this.state.gamesWon[team] ?? 0) + 1;
      const needed = Math.ceil(this.matchConfig.bestOf / 2);
      if ((this.state.gamesWon[team] ?? 0) >= needed) {
        this.state.winnerTeam = team;
        this.state.winnerSlot =
          this.state.paddles.find((paddle) => paddle.team === team)?.slot ??
          team;
        this.state.phase = 'series-over';
        this.emit('series-won', this.state.winnerSlot, null, team);
      } else {
        this.state.phase = 'game-over';
        this.state.phaseRemainingMs = 1200;
        this.emit('game-won', null, null, team);
      }
    } else {
      this.state.phase = 'point-scored';
      this.state.phaseRemainingMs = 700;
    }
    this.centerBalls();
  }

  private loseLife(slot: number, ball: PongBallState): void {
    const paddle = this.state.paddles.find((item) => item.slot === slot);
    if (paddle?.shield) {
      paddle.shield -= 1;
      this.centerBalls();
      return;
    }
    this.state.lives[slot] = Math.max(0, (this.state.lives[slot] ?? 0) - 1);
    if (this.state.lives[slot] === 0) {
      for (const item of this.state.paddles) {
        if (item.slot === slot) item.active = false;
      }
      const remaining = new Set(
        this.state.paddles
          .filter((item) => item.active)
          .map((item) => item.slot),
      );
      this.state.placements[slot] = remaining.size + 1;
      this.emit('player-eliminated', slot, null, null);
      if (remaining.size === 1) {
        const winner = [...remaining][0]!;
        this.state.placements[winner] = 1;
        this.forceWinner(winner);
        return;
      }
    }
    this.state.phase = 'point-scored';
    this.state.phaseRemainingMs = 700;
    this.centerBalls();
    this.emit('point-scored', slot, ball.id, this.state.lives[slot] ?? 0);
  }

  private endCooperativeRound(ball: PongBallState): void {
    ball.active = false;
    this.state.phase = 'series-over';
    this.emit('rally-ended', ball.lastTouchSlot, ball.id, this.state.rallyHits);
  }

  private centerBalls(): void {
    this.state.balls = Array.from(
      {
        length:
          this.matchConfig.ruleset === 'multiball'
            ? this.matchConfig.maxBalls
            : 1,
      },
      (_, id) => {
        const ball = this.servingBall(id, id);
        ball.vx = 0;
        ball.vy = 0;
        return ball;
      },
    );
  }

  private advancePhase(dtMs: number): void {
    if (this.state.phase === 'series-over' || this.state.phase === 'no-contest')
      return;
    this.state.phaseRemainingMs = Math.max(
      0,
      this.state.phaseRemainingMs - dtMs,
    );
    if (this.state.phaseRemainingMs > 0) return;
    if (this.state.phase === 'game-over') {
      this.state.score.fill(0);
      this.state.gameIndex += 1;
    }
    if (
      this.state.phase === 'countdown' ||
      this.state.phase === 'point-scored' ||
      this.state.phase === 'game-over'
    ) {
      this.state.phase = 'serving';
      this.state.phaseRemainingMs = 500;
      return;
    }
    if (this.state.phase === 'serving') {
      this.state.balls = this.createBalls();
      this.state.phase = 'rally';
      this.emit('serve', null, this.state.balls[0]?.id ?? null, null);
    }
  }

  private maybeSpawnPowerUp(): void {
    if (this.matchConfig.ruleset !== 'powerup-battle') return;
    if (this.state.elapsedMs < this.nextPowerUpAtMs) return;
    const kinds = this.matchConfig.powerUps;
    if (kinds.length === 0) return;
    const kind = kinds[Math.floor(this.rng() * kinds.length)]!;
    this.state.powerUps.push({
      id: this.nextEntityId++,
      kind,
      x: this.width * (0.25 + this.rng() * 0.5),
      y: this.height * (0.2 + this.rng() * 0.6),
      radius: 12,
      active: true,
      expiresAtMs: this.state.elapsedMs + 7000,
    });
    this.nextPowerUpAtMs += 8000;
  }

  private applyPowerUp(kind: PongPowerUpKind, paddle: PongPaddleState): void {
    const untilMs = this.state.elapsedMs + 6000;
    if (kind === 'shield') {
      paddle.shield += 1;
      return;
    }
    if (kind === 'extra-life') {
      this.state.lives[paddle.slot] = (this.state.lives[paddle.slot] ?? 0) + 1;
      return;
    }
    if (kind === 'sticky') paddle.stickyUntilMs = untilMs;
    if (kind === 'reverse-controls') {
      for (const item of this.state.paddles) {
        if (item.team !== paddle.team) item.reversedUntilMs = untilMs;
      }
    }
    if (kind === 'extra-paddle') {
      const clone = {
        ...paddle,
        id: this.nextEntityId++,
        x: paddle.x,
        y: paddle.y,
      };
      if (clone.orientation === 'vertical')
        clone.x += clone.side === 'left' ? 24 : -24;
      else clone.y += clone.side === 'top' ? 24 : -24;
      this.state.paddles.push(clone);
      this.effects.push({ kind, paddleId: clone.id, untilMs });
      return;
    }
    this.effects.push({ kind, paddleId: paddle.id, untilMs });
    this.updateEffects();
  }

  private updateEffects(): void {
    this.effects = this.effects.filter((effect) => {
      if (effect.untilMs > this.state.elapsedMs) return true;
      if (effect.kind === 'extra-paddle') {
        this.state.paddles = this.state.paddles.filter(
          (paddle) => paddle.id !== effect.paddleId,
        );
      }
      return false;
    });
    for (const paddle of this.state.paddles) {
      paddle.sizeMultiplier = 1;
      paddle.speedMultiplier = 1;
      for (const effect of this.effects) {
        if (effect.paddleId !== paddle.id) continue;
        if (effect.kind === 'grow') paddle.sizeMultiplier = 1.5;
        if (effect.kind === 'shrink') paddle.sizeMultiplier = 0.65;
        if (effect.kind === 'speed-boost') paddle.speedMultiplier = 1.5;
        if (effect.kind === 'slow') paddle.speedMultiplier = 0.65;
      }
    }
    this.state.powerUps = this.state.powerUps.filter(
      (powerUp) => powerUp.active && powerUp.expiresAtMs > this.state.elapsedMs,
    );
  }

  private releaseSticky(paddle: PongPaddleState): void {
    for (const ball of this.state.balls) {
      if (ball.stickyPaddleId !== paddle.id) continue;
      ball.stickyPaddleId = null;
      if (paddle.side === 'left') ball.vx = this.ballSpeed;
      else if (paddle.side === 'right') ball.vx = -this.ballSpeed;
      else if (paddle.side === 'top') ball.vy = this.ballSpeed;
      else ball.vy = -this.ballSpeed;
    }
  }

  private checkCompletion(): void {
    if (
      this.matchConfig.ruleset === 'breakout' &&
      this.state.bricks.every((brick) => !brick.active)
    ) {
      this.forceWinner(0);
    }
  }

  private setBallSpeed(ball: PongBallState, speed: number): void {
    const current = Math.hypot(ball.vx, ball.vy);
    if (current === 0) return;
    const scale = speed / current;
    ball.vx *= scale;
    ball.vy *= scale;
  }

  private capBall(ball: PongBallState): void {
    const speed = Math.hypot(ball.vx, ball.vy);
    if (speed > this.maxBallSpeed) this.setBallSpeed(ball, this.maxBallSpeed);
  }

  private angleDelta(a: number, b: number): number {
    return Math.atan2(Math.sin(a - b), Math.cos(a - b));
  }

  private emit(
    type: PongEngineEvent['type'],
    slot: number | null,
    entityId: number | null,
    value: number | null,
  ): void {
    this.state.lastEventSeq += 1;
    this.events.push({
      seq: this.state.lastEventSeq,
      type,
      slot,
      entityId,
      value,
    });
  }
}
