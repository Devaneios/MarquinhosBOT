import type {
  PaddleInput,
  PaddleSide,
  PongEngineConfig,
  PongState,
} from 'services/activity/pong/PongEngine';

export type BotDifficulty = 'easy' | 'normal' | 'hard';

export interface BotTuning {
  reactionMs: number;
  aimError: number;
  deadZone: number;
}

export const BOT_TUNING: Record<BotDifficulty, BotTuning> = {
  easy: { reactionMs: 450, aimError: 36, deadZone: 18 },
  normal: { reactionMs: 220, aimError: 12, deadZone: 10 },
  hard: { reactionMs: 100, aimError: 0, deadZone: 4 },
};

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

function reflectIntoRange(value: number, min: number, max: number): number {
  const span = max - min;
  if (span <= 0) return (min + max) / 2;
  const period = 2 * span;
  let m = (value - min) % period;
  if (m < 0) m += period;
  return min + (m <= span ? m : period - m);
}

// Where the ball's center will be when it reaches paddleX, accounting for
// any wall bounces between now and then. Exact (not simulated) because vx
// and vy magnitude are constant in flight — only a paddle hit changes them,
// and this is only ever called while the ball is still heading toward this
// paddle, so no such hit occurs before arrival.
export function predictImpactY(
  ball: Ball,
  paddleX: number,
  height: number,
  radius: number,
): number {
  const t = (paddleX - ball.x) / ball.vx;
  const rawY = ball.y + ball.vy * t;
  return reflectIntoRange(rawY, radius, height - radius);
}

export class PongBot {
  private targetY: number | null = null;
  private reactionElapsedMs = 0;

  constructor(
    private readonly side: PaddleSide,
    private tuning: BotTuning,
    private readonly rng: () => number = Math.random,
  ) {}

  setTuning(tuning: BotTuning) {
    this.tuning = tuning;
  }

  computeInput(
    state: PongState,
    config: Required<PongEngineConfig>,
    dtMs: number,
  ): PaddleInput {
    this.reactionElapsedMs += dtMs;
    const ballIncoming =
      this.side === 'right' ? state.ball.vx > 0 : state.ball.vx < 0;

    if (
      this.targetY === null ||
      this.reactionElapsedMs >= this.tuning.reactionMs
    ) {
      this.reactionElapsedMs = 0;
      const error = (this.rng() * 2 - 1) * this.tuning.aimError;
      if (ballIncoming) {
        const paddleX =
          this.side === 'right'
            ? config.width - config.paddleWidth
            : config.paddleWidth;
        this.targetY =
          predictImpactY(
            state.ball,
            paddleX,
            config.height,
            config.ballRadius,
          ) + error;
      } else {
        this.targetY = config.height / 2;
      }
    }

    const paddleCenter = state.paddles[this.side] + config.paddleHeight / 2;
    const deadZone = this.tuning.deadZone;
    if (this.targetY < paddleCenter - deadZone) return -1;
    if (this.targetY > paddleCenter + deadZone) return 1;
    return 0;
  }
}
