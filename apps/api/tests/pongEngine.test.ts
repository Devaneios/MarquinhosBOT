import { describe, expect, it } from 'bun:test';
import { PongEngine } from 'services/activity/pong/PongEngine';

const CONFIG = {
  width: 800,
  height: 480,
  paddleHeight: 80,
  paddleWidth: 12,
  paddleSpeed: 400,
  ballRadius: 8,
  ballSpeed: 300,
  winningScore: 5,
  pointPauseMs: 0,
};

describe('PongEngine', () => {
  it('starts centered with the ball serving toward one side', () => {
    const engine = new PongEngine(CONFIG);
    const state = engine.getState();

    expect(state.ball.x).toBe(400);
    expect(state.ball.y).toBe(240);
    expect(Math.hypot(state.ball.vx, state.ball.vy)).toBeCloseTo(300);
    expect(Math.abs(state.ball.vy)).toBeLessThan(Math.abs(state.ball.vx));
    expect(state.paddles.left).toBe((480 - 80) / 2);
    expect(state.paddles.right).toBe((480 - 80) / 2);
    expect(state.score).toEqual({ left: 0, right: 0 });
    expect(state.winner).toBeNull();
  });

  it('advances the ball position by velocity * dt on tick', () => {
    const engine = new PongEngine(CONFIG);
    const before = engine.getState();
    engine.tick(100); // 100ms
    const after = engine.getState();

    expect(after.ball.x).toBeCloseTo(before.ball.x + before.ball.vx * 0.1, 5);
    expect(after.ball.y).toBeCloseTo(before.ball.y + before.ball.vy * 0.1, 5);
  });

  it('bounces off the top wall and reflects vy', () => {
    const engine = new PongEngine(CONFIG);
    (engine as any).state.ball = { x: 400, y: 5, vx: 0, vy: -100 };

    engine.tick(100);

    const state = engine.getState();
    expect(state.ball.vy).toBeGreaterThan(0);
    expect(state.ball.y).toBeGreaterThanOrEqual(CONFIG.ballRadius);
  });

  it('bounces off the bottom wall and reflects vy', () => {
    const engine = new PongEngine(CONFIG);
    (engine as any).state.ball = { x: 400, y: 475, vx: 0, vy: 100 };

    engine.tick(100);

    const state = engine.getState();
    expect(state.ball.vy).toBeLessThan(0);
    expect(state.ball.y).toBeLessThanOrEqual(CONFIG.height - CONFIG.ballRadius);
  });

  it('reflects the ball off the left paddle when moving toward it', () => {
    const engine = new PongEngine(CONFIG);
    (engine as any).state.paddles.left = 200;
    (engine as any).state.ball = { x: 20, y: 240, vx: -100, vy: 0 };

    engine.tick(100);

    expect(engine.getState().ball.vx).toBeGreaterThan(0);
  });

  it('reflects the ball off the right paddle when moving toward it', () => {
    const engine = new PongEngine(CONFIG);
    (engine as any).state.paddles.right = 200;
    (engine as any).state.ball = { x: 780, y: 240, vx: 100, vy: 0 };

    engine.tick(100);

    expect(engine.getState().ball.vx).toBeLessThan(0);
  });

  it('does not reflect off a paddle when the ball misses its y-range', () => {
    const engine = new PongEngine(CONFIG);
    (engine as any).state.paddles.left = 0;
    (engine as any).state.ball = { x: 20, y: 400, vx: -100, vy: 0 };

    engine.tick(100);

    expect(engine.getState().ball.vx).toBeLessThan(0);
  });

  it('still registers a paddle hit when a fast ball would cross the whole paddle plane within one tick', () => {
    const engine = new PongEngine(CONFIG);
    (engine as any).state.paddles.left = 200; // spans y in [200, 280]
    // Starts just in front of the paddle and moving fast enough (with a
    // steep vy) that by the end of this tick it has travelled well past
    // the paddle's x-plane and drifted far outside its y-range — a check
    // against the ball's final position alone would see a miss, even
    // though its actual path crossed right through the paddle.
    (engine as any).state.ball = { x: 20, y: 240, vx: -3000, vy: 2000 };

    engine.tick(50);

    const state = engine.getState();
    expect(state.ball.vx).toBeGreaterThan(0);
    expect(state.score).toEqual({ left: 0, right: 0 });
  });

  it('caps ball speed after a paddle hit instead of letting it grow without bound', () => {
    const engine = new PongEngine(CONFIG);
    (engine as any).state.paddles.left = 200;
    (engine as any).state.ball = { x: 20, y: 240, vx: -700, vy: 200 };
    engine.setInput('left', 1);

    engine.tick(1);

    const { vx, vy } = engine.getState().ball;
    const maxBallSpeed = engine.getConfig().maxBallSpeed;
    expect(Math.hypot(vx, vy)).toBeLessThanOrEqual(maxBallSpeed + 1e-6);
  });

  it('scores for the right side and re-centers the ball when it passes the left edge', () => {
    const engine = new PongEngine(CONFIG);
    (engine as any).state.paddles.left = 400; // out of the ball's y-range
    (engine as any).state.ball = { x: 5, y: 240, vx: -100, vy: 0 };

    engine.tick(100);

    const state = engine.getState();
    expect(state.score).toEqual({ left: 0, right: 1 });
    expect(state.ball.x).toBe(400);
    expect(state.ball.y).toBe(240);
    expect(state.winner).toBeNull();
  });

  it('scores for the left side when the ball passes the right edge', () => {
    const engine = new PongEngine(CONFIG);
    (engine as any).state.paddles.right = 400; // out of the ball's y-range
    (engine as any).state.ball = { x: 795, y: 240, vx: 100, vy: 0 };

    engine.tick(100);

    expect(engine.getState().score).toEqual({ left: 1, right: 0 });
  });

  it('declares a winner once a side reaches the winning score and freezes the match', () => {
    const engine = new PongEngine(CONFIG);
    (engine as any).state.paddles.left = 400; // out of the ball's y-range
    (engine as any).state.score = { left: 0, right: 4 };
    (engine as any).state.ball = { x: 5, y: 240, vx: -100, vy: 0 };

    engine.tick(100);

    const state = engine.getState();
    expect(state.score.right).toBe(5);
    expect(state.winner).toBe('right');

    const ballAtWin = engine.getState().ball;
    engine.tick(1000);
    expect(engine.getState().ball).toEqual(ballAtWin);
  });

  it('forceWinner sets the winner directly, bypassing normal scoring', () => {
    const engine = new PongEngine(CONFIG);

    engine.forceWinner('left');

    expect(engine.getState().winner).toBe('left');
  });

  it('forceWinner is a no-op once a winner is already set', () => {
    const engine = new PongEngine(CONFIG);
    engine.forceWinner('left');

    engine.forceWinner('right');

    expect(engine.getState().winner).toBe('left');
  });

  it('moves a paddle according to its input direction, clamped to the field', () => {
    const engine = new PongEngine(CONFIG);
    engine.setInput('left', -1);

    engine.tick(1000); // 1s, would move 400px up (more than half the field)

    expect(engine.getState().paddles.left).toBe(engine.getConfig().cornerGap);
  });

  it('does not move a paddle with no input', () => {
    const engine = new PongEngine(CONFIG);
    const before = engine.getState().paddles.right;

    engine.setInput('right', 0);
    engine.tick(1000);

    expect(engine.getState().paddles.right).toBe(before);
  });

  it('reset() restores a fresh game after ticks and a scored point', () => {
    const engine = new PongEngine(CONFIG);
    (engine as any).state.paddles.left = 400; // out of the ball's y-range
    (engine as any).state.ball = { x: 5, y: 240, vx: -100, vy: 0 };
    engine.tick(100); // right scores, ball re-centers but score/paddles changed
    engine.setInput('left', 1);
    engine.tick(50);

    engine.reset();
    const state = engine.getState();

    expect(state.score).toEqual({ left: 0, right: 0 });
    expect(state.winner).toBeNull();
    expect(state.paddles.left).toBe((480 - 80) / 2);
    expect(state.paddles.right).toBe((480 - 80) / 2);
    expect(state.ball.x).toBe(400);
    expect(state.ball.y).toBe(240);
    const speed = Math.sqrt(state.ball.vx ** 2 + state.ball.vy ** 2);
    expect(speed).toBeCloseTo(300, 1);
  });

  it('reset() clears held paddle input so the paddle stops moving', () => {
    const engine = new PongEngine(CONFIG);
    engine.setInput('left', -1);
    engine.reset();

    const before = engine.getState().paddles.left;
    engine.tick(1000);

    expect(engine.getState().paddles.left).toBe(before);
  });

  it('maps the paddle impact offset to the outgoing angle', () => {
    const engine = new PongEngine(CONFIG, () => 0.5);
    (engine as any).state.paddles.left = 200;
    (engine as any).state.ball = { x: 20, y: 205, vx: -300, vy: 0 };

    engine.tick(40);

    const edge = engine.getState().ball;
    expect(edge.vx).toBeGreaterThan(0);
    expect(edge.vy).toBeLessThan(0);
    expect(Math.abs(edge.vy / edge.vx)).toBeGreaterThan(0.7);
  });

  it('returns a center impact almost horizontally', () => {
    const engine = new PongEngine(CONFIG, () => 0.5);
    (engine as any).state.paddles.left = 200;
    (engine as any).state.ball = { x: 20, y: 236, vx: -300, vy: 150 };

    engine.tick(40);

    const ball = engine.getState().ball;
    expect(ball.vx).toBeGreaterThan(0);
    expect(Math.abs(ball.vy)).toBeLessThan(Math.abs(ball.vx) * 0.1);
  });

  it('keeps a minimum horizontal component after paddle spin', () => {
    const engine = new PongEngine(
      { ...CONFIG, paddleSpinFactor: 10, maxBounceAngleDeg: 85 },
      () => 0.5,
    );
    (engine as any).state.paddles.left = 200;
    (engine as any).state.ball = { x: 20, y: 201, vx: -300, vy: -500 };
    engine.setInput('left', -1);

    engine.tick(40);

    const ball = engine.getState().ball;
    const speed = Math.hypot(ball.vx, ball.vy);
    expect(Math.abs(ball.vx)).toBeGreaterThanOrEqual(speed * 0.25 - 1e-6);
  });

  it('leaves a vulnerable gap at both paddle corners', () => {
    const engine = new PongEngine(CONFIG, () => 0.5);
    engine.setInput('left', -1);

    engine.tick(1000);

    expect(engine.getState().paddles.left).toBeGreaterThan(0);
    engine.setInput('left', 1);
    engine.tick(2000);
    expect(
      engine.getState().paddles.left + engine.getConfig().paddleHeight,
    ).toBeLessThan(CONFIG.height);
  });

  it('serves toward the player who conceded with a constrained random angle', () => {
    const engine = new PongEngine(CONFIG, () => 0.75);
    (engine as any).state.paddles.left = 400;
    (engine as any).state.ball = { x: -10, y: 240, vx: -300, vy: 0 };

    engine.tick(1);

    const ball = engine.getState().ball;
    expect(ball.vx).toBeLessThan(0);
    expect(ball.vy).not.toBe(0);
    expect(Math.abs(ball.vy)).toBeLessThan(Math.abs(ball.vx));
  });
});
