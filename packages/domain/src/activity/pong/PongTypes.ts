import type {
  BestOf,
  PongArenaKind,
  PongBallState,
  PongBrickState,
  PongMatchPhase,
  PongPaddleState,
  PongPowerUpKind,
  PongPowerUpState,
  PongRulesetId,
} from "@marquinhos/contracts/activity/pong/types";

export type PongAxis = -1 | 0 | 1;

export interface PongMatchConfig {
  ruleset: PongRulesetId;
  targetScore: number;
  bestOf: BestOf;
  ranked: boolean;
  lives: number;
  maxBalls: number;
  powerUps: PongPowerUpKind[];
  disconnectReplacement: "wall" | "ai";
  seed: number;
}

export interface PongRulesetDefinition {
  id: PongRulesetId;
  arena: PongArenaKind;
  minPlayers: number;
  maxPlayers: number;
  rankedPool: "classic-1v1" | "quad-elimination" | null;
  supportsBot: boolean;
  defaultConfig: PongMatchConfig;
}

export interface PongEngineEvent {
  seq: number;
  type:
    | "serve"
    | "paddle-hit"
    | "wall-hit"
    | "point-scored"
    | "game-won"
    | "series-won"
    | "brick-destroyed"
    | "powerup-collected"
    | "player-eliminated"
    | "rally-ended";
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
