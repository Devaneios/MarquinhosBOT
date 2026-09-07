import { describe, expect, it } from 'bun:test';
import {
  BOT_TUNING,
  PongBot,
  predictImpactY,
} from 'services/activity/pong/PongBotAI';
import type {
  PongEngineConfig,
  PongState,
} from 'services/activity/pong/PongEngine';

const CONFIG: Required<PongEngineConfig> = {
  width: 800,
  height: 480,
  paddleHeight: 80,
  paddleWidth: 12,
  paddleSpeed: 400,
  ballRadius: 8,
  ballSpeed: 300,
  winningScore: 5,
  paddleHitAcceleration: 1.05,
  paddleSpinFactor: 0.3,
  maxBallSpeed: 750,
  maxBounceAngleDeg: 60,
  minHorizontalSpeedRatio: 0.25,
  cornerGap: 14.4,
  maxServeAngleDeg: 25,
  pointPauseMs: 0,
  serveDelayMs: 0,
};

function state(overrides: Partial<PongState> = {}): PongState {
  return {
    width: CONFIG.width,
    height: CONFIG.height,
    ball: { x: 400, y: 240, vx: 0, vy: 0 },
    paddles: { left: 200, right: 200 },
    score: { left: 0, right: 0 },
    winner: null,
    phase: 'rally',
    phaseRemainingMs: 0,
    lastScorer: null,
    ...overrides,
  };
}

describe('predictImpactY', () => {
  it('returns the ball y unchanged for a flat, bounce-free shot', () => {
    const y = predictImpactY({ x: 0, y: 100, vx: 100, vy: 0 }, 800, 480, 8);
    expect(y).toBeCloseTo(100);
  });

  it('predicts the exact landing y through multiple wall bounces', () => {
    // Ball at x=0,y=100 heading right+down toward paddleX=800; with height
    // 480 and radius 8 the valid y-range is [8,472]. Manually simulated:
    // hits bottom, top, bottom again before arriving at y=172.
    const y = predictImpactY({ x: 0, y: 100, vx: 100, vy: 200 }, 800, 480, 8);
    expect(y).toBeCloseTo(172);
  });

  it('predicts a single bottom-wall bounce correctly', () => {
    // Ball moving down and right; bounces once off the bottom before
    // reaching the paddle plane.
    const y = predictImpactY({ x: 700, y: 400, vx: 100, vy: 300 }, 800, 480, 8);
    // t = 1s, rawY = 700, relative = 692, span = 464, period = 928
    // 692 <= 464? no -> reflected = 928 - 692 = 236 -> y = 8 + 236 = 244
    expect(y).toBeCloseTo(244);
  });

  it('handles negative vx (ball heading toward the left paddle)', () => {
    const y = predictImpactY({ x: 100, y: 240, vx: -100, vy: 0 }, 12, 480, 8);
    expect(y).toBeCloseTo(240);
  });
});

describe('PongBot', () => {
  it('moves toward the predicted intercept when the ball is incoming', () => {
    const bot = new PongBot('right', BOT_TUNING.hard, () => 0.5);
    const s = state({
      ball: { x: 700, y: 400, vx: 100, vy: 0 },
      paddles: { left: 200, right: 0 },
    });

    const input = bot.computeInput(s, CONFIG, 8);

    expect(input).toBe(1); // paddle center (40) is well below target (400)
  });

  it('recenters when the ball is moving away from the bot', () => {
    const bot = new PongBot('right', BOT_TUNING.hard, () => 0.5);
    const s = state({
      ball: { x: 100, y: 400, vx: -100, vy: 0 },
      paddles: { left: 200, right: 400 },
    });

    const input = bot.computeInput(s, CONFIG, 8);

    // target is height/2 = 240, paddle center is 400+40=440 -> move up
    expect(input).toBe(-1);
  });

  it('stops once the paddle center is within the dead zone of the target', () => {
    const bot = new PongBot('right', BOT_TUNING.hard, () => 0.5);
    const s = state({
      ball: { x: 700, y: 400, vx: 100, vy: 0 },
      paddles: { left: 200, right: 360 }, // center = 400, matches target
    });

    const input = bot.computeInput(s, CONFIG, 8);

    expect(input).toBe(0);
  });

  it('only recomputes its target once the reaction window elapses', () => {
    const bot = new PongBot('right', BOT_TUNING.normal, () => 0.5);
    const first = state({
      ball: { x: 700, y: 400, vx: 100, vy: 0 },
      paddles: { left: 200, right: 0 },
    });
    bot.computeInput(first, CONFIG, 8); // locks target ~400

    // Ball y jumps far away, but well within the reaction window (normal =
    // 220ms) so the bot must keep steering at the stale target, not the
    // new ball position.
    const second = state({
      ball: { x: 700, y: 10, vx: 100, vy: 0 },
      paddles: { left: 200, right: 360 }, // center 400, matches stale target
    });
    const input = bot.computeInput(second, CONFIG, 8);

    expect(input).toBe(0);
  });

  it('applies rng-derived aim error scaled by the tuning', () => {
    const bot = new PongBot('right', BOT_TUNING.easy, () => 1); // max positive error
    const s = state({
      ball: { x: 700, y: 400, vx: 100, vy: 0 },
      // Paddle center (400) exactly matches the un-erred target (400), which
      // would sit dead center in the dead zone (18) and yield 0. The max
      // positive error (+36) pushes the target to 436, past the dead zone.
      paddles: { left: 200, right: 360 }, // center = 400
    });

    const input = bot.computeInput(s, CONFIG, 8);

    expect(input).toBe(1);
  });

  it('never drives the paddle beyond the side it was constructed for', () => {
    const bot = new PongBot('left', BOT_TUNING.hard, () => 0.5);
    const s = state({
      ball: { x: 100, y: 400, vx: -100, vy: 0 },
      paddles: { left: 0, right: 200 },
    });

    expect(() => bot.computeInput(s, CONFIG, 8)).not.toThrow();
  });
});

describe('BOT_TUNING', () => {
  it('gets progressively sharper from easy to hard', () => {
    expect(BOT_TUNING.easy.reactionMs).toBeGreaterThan(
      BOT_TUNING.normal.reactionMs,
    );
    expect(BOT_TUNING.normal.reactionMs).toBeGreaterThan(
      BOT_TUNING.hard.reactionMs,
    );
    expect(BOT_TUNING.easy.aimError).toBeGreaterThan(
      BOT_TUNING.normal.aimError,
    );
    expect(BOT_TUNING.normal.aimError).toBeGreaterThan(
      BOT_TUNING.hard.aimError,
    );
    expect(BOT_TUNING.easy.deadZone).toBeGreaterThan(
      BOT_TUNING.normal.deadZone,
    );
    expect(BOT_TUNING.normal.deadZone).toBeGreaterThan(
      BOT_TUNING.hard.deadZone,
    );
  });
});
