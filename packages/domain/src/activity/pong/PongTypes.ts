export type PongRulesetId =
  | 'classic-1v1'
  | 'doubles-2v2'
  | 'quad-elimination'
  | 'superpong'
  | 'rebound'
  | 'breakout'
  | 'brick-battle'
  | 'multiball'
  | 'powerup-battle'
  | 'radial-solo'
  | 'radial-duel'
  | 'pong-tennis'
  | 'air-hockey'
  | 'coop-keep-alive';

export type PongArenaKind =
  | 'rectangular'
  | 'square'
  | 'volleyball'
  | 'breakout'
  | 'circular'
  | 'air-hockey';

export type PongMatchPhase =
  | 'lobby'
  | 'countdown'
  | 'serving'
  | 'rally'
  | 'point-scored'
  | 'game-over'
  | 'series-over'
  | 'paused-disconnect'
  | 'no-contest';

export type PongSide = 'left' | 'right' | 'top' | 'bottom';
export type PongAxis = -1 | 0 | 1;
export type PongOrientation = 'vertical' | 'horizontal' | 'radial';
export type PongPowerUpKind =
  | 'grow'
  | 'shrink'
  | 'speed-boost'
  | 'slow'
  | 'sticky'
  | 'extra-paddle'
  | 'reverse-controls'
  | 'shield'
  | 'extra-life';

export interface PongMatchConfig {
  ruleset: PongRulesetId;
  targetScore: number;
  bestOf: 1 | 3 | 5;
  ranked: boolean;
  lives: number;
  maxBalls: number;
  powerUps: PongPowerUpKind[];
  disconnectReplacement: 'wall' | 'ai';
  seed: number;
}

export interface PongRulesetDefinition {
  id: PongRulesetId;
  arena: PongArenaKind;
  minPlayers: number;
  maxPlayers: number;
  rankedPool: 'classic-1v1' | 'quad-elimination' | null;
  supportsBot: boolean;
  defaultConfig: PongMatchConfig;
}

export interface PongBallState {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  spin: number;
  lastTouchSlot: number | null;
  stickyPaddleId: number | null;
  active: boolean;
}

export interface PongPaddleState {
  id: number;
  slot: number;
  team: number;
  side: PongSide;
  orientation: PongOrientation;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
  arc: number;
  axisPosition: number;
  velocity: number;
  sizeMultiplier: number;
  speedMultiplier: number;
  shield: number;
  reversedUntilMs: number;
  stickyUntilMs: number;
  active: boolean;
}

export interface PongBrickState {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  hp: number;
  active: boolean;
}

export interface PongPowerUpState {
  id: number;
  kind: PongPowerUpKind;
  x: number;
  y: number;
  radius: number;
  active: boolean;
  expiresAtMs: number;
}

export interface PongEngineEvent {
  seq: number;
  type:
    | 'serve'
    | 'paddle-hit'
    | 'wall-hit'
    | 'point-scored'
    | 'game-won'
    | 'series-won'
    | 'brick-destroyed'
    | 'powerup-collected'
    | 'player-eliminated'
    | 'rally-ended';
  slot: number | null;
  entityId: number | null;
  value: number | null;
}

export interface PongEngineState {
  width: number;
  height: number;
  ruleset: PongRulesetId;
  arena: PongArenaKind;
  phase: PongMatchPhase;
  phaseRemainingMs: number;
  elapsedMs: number;
  balls: PongBallState[];
  paddles: PongPaddleState[];
  bricks: PongBrickState[];
  powerUps: PongPowerUpState[];
  score: number[];
  lives: number[];
  gamesWon: number[];
  gameIndex: number;
  rallyHits: number;
  winnerSlot: number | null;
  winnerTeam: number | null;
  placements: number[];
  lastEventSeq: number;
}

export interface PongInputState {
  axis: PongAxis;
  target: number | null;
  release: boolean;
}
