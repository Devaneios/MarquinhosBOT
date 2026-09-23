import { z } from 'zod';

export type GameMode = 'single' | 'multi' | 'local';

export const botDifficultySchema = z.enum(['easy', 'normal', 'hard']);
export type BotDifficulty = z.infer<typeof botDifficultySchema>;

export const winScoreSchema = z.union([
  z.literal(7),
  z.literal(10),
  z.literal(11),
  z.literal(15),
  z.literal(21),
]);
export type WinScore = z.infer<typeof winScoreSchema>;

export const bestOfSchema = z.union([z.literal(1), z.literal(3), z.literal(5)]);
export type BestOf = z.infer<typeof bestOfSchema>;

export const PONG_PHASES = [
  'lobby',
  'countdown',
  'serving',
  'rally',
  'point-scored',
  'game-over',
  'series-over',
  'paused-disconnect',
  'no-contest',
] as const;
export type PongMatchPhase = (typeof PONG_PHASES)[number];

export const PONG_RULESETS = [
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
] as const;
export const pongRulesetIdSchema = z.enum(PONG_RULESETS);
export type PongRulesetId = z.infer<typeof pongRulesetIdSchema>;

export const PONG_ARENAS = [
  'rectangular',
  'square',
  'volleyball',
  'breakout',
  'circular',
  'air-hockey',
] as const;
export type PongArenaKind = (typeof PONG_ARENAS)[number];

export const PONG_SIDES = ['left', 'right', 'top', 'bottom'] as const;
export const pongSideSchema = z.enum(PONG_SIDES);
export type PongSide = z.infer<typeof pongSideSchema>;

export const PONG_POWERUPS = [
  'grow',
  'shrink',
  'speed-boost',
  'slow',
  'sticky',
  'extra-paddle',
  'reverse-controls',
  'shield',
  'extra-life',
] as const;
export type PongPowerUpKind = (typeof PONG_POWERUPS)[number];

export type PongOrientation = 'vertical' | 'horizontal' | 'radial';

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
