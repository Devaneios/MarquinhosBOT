import type {
  PongArenaKind,
  PongBallState,
  PongBrickState,
  PongMatchPhase,
  PongPaddleState,
  PongPowerUpKind,
  PongPowerUpState,
  PongRulesetId,
  PongSide,
} from './types';

export const PONG_PROTOCOL_VERSION = 2;
const HEADER_BYTES = 32;
const PADDLE_BYTES = 52;
const BALL_BYTES = 32;
const BRICK_BYTES = 20;
const POWERUP_BYTES = 20;

const PHASES: PongMatchPhase[] = [
  'lobby',
  'countdown',
  'serving',
  'rally',
  'point-scored',
  'game-over',
  'series-over',
  'paused-disconnect',
  'no-contest',
];
const RULESETS: PongRulesetId[] = [
  'classic-1v1',
  'doubles-2v2',
  'quad-elimination',
  'superpong',
  'rebound',
  'breakout',
  'brick-battle',
  'multiball',
  'powerup-battle',
  'radial-solo',
  'radial-duel',
  'pong-tennis',
  'air-hockey',
  'coop-keep-alive',
];
const ARENAS: PongArenaKind[] = [
  'rectangular',
  'square',
  'volleyball',
  'breakout',
  'circular',
  'air-hockey',
];
const SIDES: PongSide[] = ['left', 'right', 'top', 'bottom'];
const POWERUPS: PongPowerUpKind[] = [
  'grow',
  'shrink',
  'speed-boost',
  'slow',
  'sticky',
  'extra-paddle',
  'reverse-controls',
  'shield',
  'extra-life',
];

export interface DecodedSnapshot {
  seq: number;
  serverTimeMs: number;
  phase: PongMatchPhase;
  phaseRemainingMs: number;
  ruleset: PongRulesetId;
  arena: PongArenaKind;
  targetScore: number;
  bestOf: number;
  gameIndex: number;
  winnerSlot: number | null;
  lastEventSeq: number;
  acks: number[];
  score: number[];
  gamesWon: number[];
  lives: number[];
  paddles: PongPaddleState[];
  balls: PongBallState[];
  bricks: PongBrickState[];
  powerUps: PongPowerUpState[];
  ball: PongBallState;
  classicPaddles: { left: number; right: number };
  classicScore: { left: number; right: number };
  winner: 'left' | 'right' | null;
}

function readEnum<T>(values: readonly T[], index: number, name: string): T {
  const value = values[index];
  if (value === undefined) throw new Error(`Invalid Pong ${name}`);
  return value;
}

export function decodeStateSnapshot(buffer: ArrayBuffer): DecodedSnapshot {
  if (buffer.byteLength < HEADER_BYTES) {
    throw new Error('Truncated Pong snapshot header');
  }
  const view = new DataView(buffer);
  if (view.getUint8(0) !== PONG_PROTOCOL_VERSION) {
    throw new Error('Unsupported Pong protocol version');
  }
  const ackCount = view.getUint8(19);
  const paddleCount = view.getUint8(20);
  const ballCount = view.getUint8(21);
  const brickCount = view.getUint8(22);
  const powerUpCount = view.getUint8(23);
  const scoreCount = view.getUint8(24);
  const gamesCount = view.getUint8(25);
  const livesCount = view.getUint8(26);
  const expectedBytes =
    HEADER_BYTES +
    ackCount * 4 +
    scoreCount * 2 +
    gamesCount +
    livesCount +
    paddleCount * PADDLE_BYTES +
    ballCount * BALL_BYTES +
    brickCount * BRICK_BYTES +
    powerUpCount * POWERUP_BYTES;
  if (buffer.byteLength !== expectedBytes) {
    throw new Error('Invalid Pong snapshot size');
  }
  const serverTimeMs = view.getUint32(8);
  let offset = HEADER_BYTES;
  const acks = Array.from({ length: ackCount }, () => {
    const value = view.getUint32(offset);
    offset += 4;
    return value;
  });
  const score = Array.from({ length: scoreCount }, () => {
    const value = view.getUint16(offset);
    offset += 2;
    return value;
  });
  const gamesWon = Array.from({ length: gamesCount }, () =>
    view.getUint8(offset++),
  );
  const lives = Array.from({ length: livesCount }, () =>
    view.getUint8(offset++),
  );
  const paddles = Array.from({ length: paddleCount }, (): PongPaddleState => {
    const side = readEnum(SIDES, view.getUint8(offset + 3), 'paddle side');
    const flags = view.getUint16(offset + 36);
    const paddle: PongPaddleState = {
      id: view.getUint8(offset),
      slot: view.getUint8(offset + 1),
      team: view.getUint8(offset + 2),
      side,
      orientation:
        (flags & 16) !== 0
          ? 'radial'
          : (flags & 8) !== 0
            ? 'horizontal'
            : 'vertical',
      x: view.getFloat32(offset + 4),
      y: view.getFloat32(offset + 8),
      width: view.getFloat32(offset + 12),
      height: view.getFloat32(offset + 16),
      axisPosition: view.getFloat32(offset + 20),
      velocity: view.getFloat32(offset + 24),
      angle: view.getFloat32(offset + 28),
      arc: view.getFloat32(offset + 32),
      active: (flags & 1) !== 0,
      reversedUntilMs: view.getUint32(offset + 44),
      stickyUntilMs: view.getUint32(offset + 48),
      shield: view.getUint8(offset + 38),
      sizeMultiplier: view.getUint8(offset + 39) / 100,
      speedMultiplier: view.getFloat32(offset + 40),
    };
    offset += PADDLE_BYTES;
    return paddle;
  });
  const balls = Array.from({ length: ballCount }, (): PongBallState => {
    const lastTouchSlot = view.getInt8(offset + 28);
    const stickyPaddleId = view.getInt8(offset + 29);
    const ball: PongBallState = {
      id: view.getUint16(offset),
      active: view.getUint8(offset + 2) !== 0,
      x: view.getFloat32(offset + 4),
      y: view.getFloat32(offset + 8),
      vx: view.getFloat32(offset + 12),
      vy: view.getFloat32(offset + 16),
      radius: view.getFloat32(offset + 20),
      spin: view.getFloat32(offset + 24),
      lastTouchSlot: lastTouchSlot < 0 ? null : lastTouchSlot,
      stickyPaddleId: stickyPaddleId < 0 ? null : stickyPaddleId,
    };
    offset += BALL_BYTES;
    return ball;
  });
  const bricks = Array.from({ length: brickCount }, (): PongBrickState => {
    const brick: PongBrickState = {
      id: view.getUint16(offset),
      hp: view.getUint8(offset + 2),
      active: view.getUint8(offset + 3) !== 0,
      x: view.getFloat32(offset + 4),
      y: view.getFloat32(offset + 8),
      width: view.getFloat32(offset + 12),
      height: view.getFloat32(offset + 16),
    };
    offset += BRICK_BYTES;
    return brick;
  });
  const powerUps = Array.from(
    { length: powerUpCount },
    (): PongPowerUpState => {
      const powerUp: PongPowerUpState = {
        id: view.getUint16(offset),
        kind: readEnum(POWERUPS, view.getUint8(offset + 2), 'power-up kind'),
        active: view.getUint8(offset + 3) !== 0,
        x: view.getFloat32(offset + 4),
        y: view.getFloat32(offset + 8),
        radius: view.getFloat32(offset + 12),
        expiresAtMs: view.getUint32(offset + 16),
      };
      offset += POWERUP_BYTES;
      return powerUp;
    },
  );
  const winner = view.getUint8(3);
  const primaryBall = balls[0] ?? {
    id: 0,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    radius: 0,
    spin: 0,
    lastTouchSlot: null,
    stickyPaddleId: null,
    active: false,
  };
  const leftPaddle = paddles.find((paddle) => paddle.side === 'left');
  const rightPaddle = paddles.find((paddle) => paddle.side === 'right');
  return {
    seq: view.getUint32(4),
    serverTimeMs,
    phase: readEnum(PHASES, view.getUint8(1), 'phase'),
    phaseRemainingMs: view.getFloat32(12),
    ruleset: readEnum(RULESETS, view.getUint8(2), 'ruleset'),
    arena: readEnum(ARENAS, view.getUint8(27), 'arena'),
    targetScore: view.getUint8(16),
    bestOf: view.getUint8(17),
    gameIndex: view.getUint8(18),
    winnerSlot: winner === 255 ? null : winner,
    lastEventSeq: view.getUint32(28),
    acks,
    score,
    gamesWon,
    lives,
    paddles,
    balls,
    bricks,
    powerUps,
    ball: primaryBall,
    classicPaddles: {
      left: leftPaddle?.y ?? 0,
      right: rightPaddle?.y ?? 0,
    },
    classicScore: { left: score[0] ?? 0, right: score[1] ?? 0 },
    winner: winner === 0 ? 'left' : winner === 1 ? 'right' : null,
  };
}
