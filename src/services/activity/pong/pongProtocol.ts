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
} from 'services/activity/pong/PongTypes';

export const PONG_PROTOCOL_VERSION = 2;
export const PONG_SNAPSHOT_HEADER_BYTES = 32;
export const PONG_PADDLE_BYTES = 52;
export const PONG_BALL_BYTES = 32;
export const PONG_BRICK_BYTES = 20;
export const PONG_POWERUP_BYTES = 20;

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

export interface PongSnapshot {
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
}

function enumIndex<T>(values: readonly T[], value: T): number {
  const index = values.indexOf(value);
  if (index < 0) throw new Error(`Unsupported Pong protocol value: ${value}`);
  return index;
}

function assertCount(name: string, count: number): void {
  if (!Number.isInteger(count) || count < 0 || count > 255) {
    throw new Error(`Invalid Pong ${name} count`);
  }
}

export function encodeStateSnapshot(snapshot: PongSnapshot): ArrayBuffer {
  const counts = [
    snapshot.acks.length,
    snapshot.paddles.length,
    snapshot.balls.length,
    snapshot.bricks.length,
    snapshot.powerUps.length,
    snapshot.score.length,
    snapshot.gamesWon.length,
    snapshot.lives.length,
  ];
  counts.forEach((count, index) => assertCount(String(index), count));

  const bytes =
    PONG_SNAPSHOT_HEADER_BYTES +
    snapshot.acks.length * 4 +
    snapshot.score.length * 2 +
    snapshot.gamesWon.length +
    snapshot.lives.length +
    snapshot.paddles.length * PONG_PADDLE_BYTES +
    snapshot.balls.length * PONG_BALL_BYTES +
    snapshot.bricks.length * PONG_BRICK_BYTES +
    snapshot.powerUps.length * PONG_POWERUP_BYTES;
  const buffer = new ArrayBuffer(bytes);
  const view = new DataView(buffer);
  view.setUint8(0, PONG_PROTOCOL_VERSION);
  view.setUint8(1, enumIndex(PHASES, snapshot.phase));
  view.setUint8(2, enumIndex(RULESETS, snapshot.ruleset));
  view.setUint8(3, snapshot.winnerSlot ?? 255);
  view.setUint32(4, snapshot.seq);
  view.setUint32(8, snapshot.serverTimeMs >>> 0);
  view.setFloat32(12, snapshot.phaseRemainingMs);
  view.setUint8(16, snapshot.targetScore);
  view.setUint8(17, snapshot.bestOf);
  view.setUint8(18, snapshot.gameIndex);
  view.setUint8(19, snapshot.acks.length);
  view.setUint8(20, snapshot.paddles.length);
  view.setUint8(21, snapshot.balls.length);
  view.setUint8(22, snapshot.bricks.length);
  view.setUint8(23, snapshot.powerUps.length);
  view.setUint8(24, snapshot.score.length);
  view.setUint8(25, snapshot.gamesWon.length);
  view.setUint8(26, snapshot.lives.length);
  view.setUint8(27, enumIndex(ARENAS, snapshot.arena));
  view.setUint32(28, snapshot.lastEventSeq);

  let offset = PONG_SNAPSHOT_HEADER_BYTES;
  for (const ack of snapshot.acks) {
    view.setUint32(offset, ack);
    offset += 4;
  }
  for (const score of snapshot.score) {
    view.setUint16(offset, score);
    offset += 2;
  }
  for (const games of snapshot.gamesWon) view.setUint8(offset++, games);
  for (const lives of snapshot.lives) view.setUint8(offset++, lives);

  for (const paddle of snapshot.paddles) {
    view.setUint8(offset, paddle.id);
    view.setUint8(offset + 1, paddle.slot);
    view.setUint8(offset + 2, paddle.team);
    view.setUint8(offset + 3, enumIndex(SIDES, paddle.side));
    view.setFloat32(offset + 4, paddle.x);
    view.setFloat32(offset + 8, paddle.y);
    view.setFloat32(offset + 12, paddle.width);
    view.setFloat32(offset + 16, paddle.height);
    view.setFloat32(offset + 20, paddle.axisPosition);
    view.setFloat32(offset + 24, paddle.velocity);
    view.setFloat32(offset + 28, paddle.angle);
    view.setFloat32(offset + 32, paddle.arc);
    let flags = paddle.active ? 1 : 0;
    if (paddle.reversedUntilMs > snapshot.serverTimeMs) flags |= 2;
    if (paddle.stickyUntilMs > snapshot.serverTimeMs) flags |= 4;
    if (paddle.orientation === 'horizontal') flags |= 8;
    if (paddle.orientation === 'radial') flags |= 16;
    view.setUint16(offset + 36, flags);
    view.setUint8(offset + 38, paddle.shield);
    view.setUint8(offset + 39, Math.round(paddle.sizeMultiplier * 100));
    view.setFloat32(offset + 40, paddle.speedMultiplier);
    view.setUint32(offset + 44, paddle.reversedUntilMs >>> 0);
    view.setUint32(offset + 48, paddle.stickyUntilMs >>> 0);
    offset += PONG_PADDLE_BYTES;
  }

  for (const ball of snapshot.balls) {
    view.setUint16(offset, ball.id);
    view.setUint8(offset + 2, ball.active ? 1 : 0);
    view.setUint8(offset + 3, 0);
    view.setFloat32(offset + 4, ball.x);
    view.setFloat32(offset + 8, ball.y);
    view.setFloat32(offset + 12, ball.vx);
    view.setFloat32(offset + 16, ball.vy);
    view.setFloat32(offset + 20, ball.radius);
    view.setFloat32(offset + 24, ball.spin);
    view.setInt8(offset + 28, ball.lastTouchSlot ?? -1);
    view.setInt8(offset + 29, ball.stickyPaddleId ?? -1);
    view.setUint16(offset + 30, 0);
    offset += PONG_BALL_BYTES;
  }

  for (const brick of snapshot.bricks) {
    view.setUint16(offset, brick.id);
    view.setUint8(offset + 2, brick.hp);
    view.setUint8(offset + 3, brick.active ? 1 : 0);
    view.setFloat32(offset + 4, brick.x);
    view.setFloat32(offset + 8, brick.y);
    view.setFloat32(offset + 12, brick.width);
    view.setFloat32(offset + 16, brick.height);
    offset += PONG_BRICK_BYTES;
  }

  for (const powerUp of snapshot.powerUps) {
    view.setUint16(offset, powerUp.id);
    view.setUint8(offset + 2, enumIndex(POWERUPS, powerUp.kind));
    view.setUint8(offset + 3, powerUp.active ? 1 : 0);
    view.setFloat32(offset + 4, powerUp.x);
    view.setFloat32(offset + 8, powerUp.y);
    view.setFloat32(offset + 12, powerUp.radius);
    view.setUint32(offset + 16, powerUp.expiresAtMs >>> 0);
    offset += PONG_POWERUP_BYTES;
  }
  return buffer;
}

export const PONG_PROTOCOL_VALUES = {
  phases: PHASES,
  rulesets: RULESETS,
  arenas: ARENAS,
  sides: SIDES,
  powerUps: POWERUPS,
} as const;

function readEnum<T>(values: readonly T[], index: number, name: string): T {
  const value = values[index];
  if (value === undefined) throw new Error(`Invalid Pong ${name}`);
  return value;
}

export function decodeStateSnapshot(buffer: ArrayBuffer): PongSnapshot {
  if (buffer.byteLength < PONG_SNAPSHOT_HEADER_BYTES) {
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
    PONG_SNAPSHOT_HEADER_BYTES +
    ackCount * 4 +
    scoreCount * 2 +
    gamesCount +
    livesCount +
    paddleCount * PONG_PADDLE_BYTES +
    ballCount * PONG_BALL_BYTES +
    brickCount * PONG_BRICK_BYTES +
    powerUpCount * PONG_POWERUP_BYTES;
  if (buffer.byteLength !== expectedBytes) {
    throw new Error('Invalid Pong snapshot size');
  }

  const serverTimeMs = view.getUint32(8);
  let offset = PONG_SNAPSHOT_HEADER_BYTES;
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
    offset += PONG_PADDLE_BYTES;
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
    offset += PONG_BALL_BYTES;
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
    offset += PONG_BRICK_BYTES;
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
      offset += PONG_POWERUP_BYTES;
      return powerUp;
    },
  );

  const winner = view.getUint8(3);
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
  };
}
