export type GameMode = 'single' | 'multi' | 'local';
export type BotDifficulty = 'easy' | 'normal' | 'hard';
export type WinScore = 7 | 10 | 11 | 15 | 21;
export type BestOf = 1 | 3 | 5;

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

export interface PongPaddleState {
  id: number;
  slot: number;
  team: number;
  side: PongSide;
  orientation: 'vertical' | 'horizontal' | 'radial';
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
