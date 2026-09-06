import type { DecodedSnapshot } from './protocol';

export interface PongInputCommand {
  seq: number;
  sentAt: number;
  axis?: -1 | 0 | 1;
  target?: number;
}

export interface PaddlePredictionConfig {
  min: number;
  max: number;
  speed: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function movePaddle(
  position: number,
  command: PongInputCommand,
  dtMs: number,
  config: PaddlePredictionConfig,
): number {
  const maxStep = config.speed * (dtMs / 1000);
  if (command.target !== undefined) {
    const desired =
      config.min + clamp(command.target, 0, 1) * (config.max - config.min);
    return clamp(
      position + clamp(desired - position, -maxStep, maxStep),
      config.min,
      config.max,
    );
  }
  return clamp(
    position + (command.axis ?? 0) * maxStep,
    config.min,
    config.max,
  );
}

export class LocalPaddlePredictor {
  private commands: PongInputCommand[] = [];
  private acknowledged: PongInputCommand = { seq: 0, sentAt: 0, axis: 0 };
  private readonly config: PaddlePredictionConfig;

  constructor(config: PaddlePredictionConfig) {
    this.config = config;
  }

  push(command: PongInputCommand): void {
    if (command.seq <= (this.commands.at(-1)?.seq ?? this.acknowledged.seq)) {
      return;
    }
    this.commands.push(command);
  }

  reconcile(
    authoritativePosition: number,
    ack: number,
    authoritativeAt: number,
    now: number,
  ): number {
    for (const command of this.commands) {
      if (command.seq <= ack && command.seq >= this.acknowledged.seq) {
        this.acknowledged = command;
      }
    }
    this.commands = this.commands.filter((command) => command.seq > ack);
    let position = clamp(
      authoritativePosition,
      this.config.min,
      this.config.max,
    );
    let cursor = authoritativeAt;
    let active = this.acknowledged;
    for (const command of this.commands) {
      const commandAt = clamp(command.sentAt, cursor, now);
      position = movePaddle(position, active, commandAt - cursor, this.config);
      active = command;
      cursor = commandAt;
    }
    return movePaddle(position, active, Math.max(0, now - cursor), this.config);
  }

  pendingSequences(): number[] {
    return this.commands.map((command) => command.seq);
  }
}

export interface BufferedSnapshot {
  state: DecodedSnapshot;
  receivedAt: number;
}

export interface RenderSample {
  state: DecodedSnapshot;
  extrapolated: boolean;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function interpolateSnapshot(
  from: DecodedSnapshot,
  to: DecodedSnapshot,
  t: number,
): DecodedSnapshot {
  const paddles = to.paddles.map((paddle) => {
    const previous = from.paddles.find((item) => item.id === paddle.id);
    return previous
      ? {
          ...paddle,
          x: lerp(previous.x, paddle.x, t),
          y: lerp(previous.y, paddle.y, t),
          axisPosition: lerp(previous.axisPosition, paddle.axisPosition, t),
          angle: lerp(previous.angle, paddle.angle, t),
        }
      : paddle;
  });
  const balls = to.balls.map((ball) => {
    const previous = from.balls.find((item) => item.id === ball.id);
    return previous
      ? {
          ...ball,
          x: lerp(previous.x, ball.x, t),
          y: lerp(previous.y, ball.y, t),
          vx: lerp(previous.vx, ball.vx, t),
          vy: lerp(previous.vy, ball.vy, t),
        }
      : ball;
  });
  const ball = balls[0] ?? to.ball;
  const left = paddles.find((paddle) => paddle.side === 'left');
  const right = paddles.find((paddle) => paddle.side === 'right');
  return {
    ...to,
    paddles,
    balls,
    ball,
    classicPaddles: {
      left: left?.y ?? to.classicPaddles.left,
      right: right?.y ?? to.classicPaddles.right,
    },
  };
}

export class PongSnapshotBuffer {
  private snapshots: BufferedSnapshot[] = [];
  private clockOffsetMs: number | null = null;
  private readonly interpolationDelayMs: number;
  private readonly maxExtrapolationMs: number;

  constructor(interpolationDelayMs = 100, maxExtrapolationMs = 100) {
    this.interpolationDelayMs = interpolationDelayMs;
    this.maxExtrapolationMs = maxExtrapolationMs;
  }

  push(state: DecodedSnapshot, receivedAt: number): void {
    if (this.snapshots.some((item) => item.state.seq === state.seq)) return;
    const offsetSample = receivedAt - state.serverTimeMs;
    this.clockOffsetMs =
      this.clockOffsetMs === null
        ? offsetSample
        : Math.min(this.clockOffsetMs + 2, offsetSample);
    this.snapshots.push({ state, receivedAt });
    this.snapshots.sort((a, b) => a.state.serverTimeMs - b.state.serverTimeMs);
    if (this.snapshots.length > 64) {
      this.snapshots.splice(0, this.snapshots.length - 64);
    }
  }

  localTimeForServer(serverTimeMs: number): number | null {
    return this.clockOffsetMs === null
      ? null
      : serverTimeMs + this.clockOffsetMs;
  }

  sample(now: number): RenderSample | null {
    if (this.snapshots.length === 0 || this.clockOffsetMs === null) return null;
    const serverNow = now - this.clockOffsetMs;
    const renderAt = serverNow - this.interpolationDelayMs;
    let before = this.snapshots[0]!;
    let after: BufferedSnapshot | null = null;
    for (const snapshot of this.snapshots) {
      if (snapshot.state.serverTimeMs <= renderAt) before = snapshot;
      if (snapshot.state.serverTimeMs >= renderAt) {
        after = snapshot;
        break;
      }
    }
    if (after && after !== before) {
      const span = after.state.serverTimeMs - before.state.serverTimeMs;
      const t =
        span <= 0
          ? 1
          : clamp((renderAt - before.state.serverTimeMs) / span, 0, 1);
      return {
        state: interpolateSnapshot(before.state, after.state, t),
        extrapolated: false,
      };
    }
    const dtMs = clamp(
      renderAt - before.state.serverTimeMs,
      0,
      this.maxExtrapolationMs,
    );
    if (dtMs === 0 || before.state.phase !== 'rally') {
      return { state: before.state, extrapolated: false };
    }
    const balls = before.state.balls.map((ball) => ({
      ...ball,
      x: ball.x + ball.vx * (dtMs / 1000),
      y: ball.y + ball.vy * (dtMs / 1000),
    }));
    const paddles = before.state.paddles.map((paddle) => ({
      ...paddle,
      x:
        paddle.x +
        (paddle.orientation === 'horizontal'
          ? paddle.velocity * (dtMs / 1000)
          : 0),
      y:
        paddle.y +
        (paddle.orientation === 'vertical'
          ? paddle.velocity * (dtMs / 1000)
          : 0),
    }));
    const left = paddles.find((paddle) => paddle.side === 'left');
    const right = paddles.find((paddle) => paddle.side === 'right');
    return {
      state: {
        ...before.state,
        balls,
        paddles,
        ball: balls[0] ?? before.state.ball,
        classicPaddles: {
          left: left?.y ?? before.state.classicPaddles.left,
          right: right?.y ?? before.state.classicPaddles.right,
        },
      },
      extrapolated: true,
    };
  }
}
