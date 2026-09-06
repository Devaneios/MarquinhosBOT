import { describe, expect, it } from 'bun:test';
import { PongArenaEngine } from 'services/activity/pong/PongArenaEngine';
import { PONG_RULESETS } from 'services/activity/pong/PongRulesetRegistry';
import type { PongRulesetId } from 'services/activity/pong/PongTypes';

function engine(ruleset: PongRulesetId) {
  return new PongArenaEngine({ ruleset, seed: 7 });
}

describe('PongArenaEngine', () => {
  it('runs a countdown and constrained serve before the first rally', () => {
    const engine = new PongArenaEngine({ ruleset: 'classic-1v1' });

    engine.begin();
    expect(engine.getState().phase).toBe('countdown');
    expect(engine.getState().balls[0]!.vx).toBe(0);
    engine.tick(1200);
    expect(engine.getState().phase).toBe('serving');
    engine.tick(500);
    expect(engine.getState().phase).toBe('rally');
    expect(Math.abs(engine.getState().balls[0]!.vx)).toBeGreaterThan(0);
  });

  it('registers every requested ruleset', () => {
    expect(PONG_RULESETS.map((item) => item.id)).toEqual([
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
    ]);
  });

  it('creates classic 1v1 with two paddles and one ball', () => {
    const state = engine('classic-1v1').getState();

    expect(state.paddles).toHaveLength(2);
    expect(state.balls).toHaveLength(1);
    expect(state.arena).toBe('rectangular');
  });

  it('creates doubles paddles at distinct depths for two teams', () => {
    const state = engine('doubles-2v2').getState();

    expect(state.paddles).toHaveLength(4);
    expect(new Set(state.paddles.map((paddle) => paddle.team))).toEqual(
      new Set([0, 1]),
    );
    expect(new Set(state.paddles.map((paddle) => paddle.x)).size).toBe(4);
  });

  it('creates four defended sides with lives for Quadrapong', () => {
    const state = engine('quad-elimination').getState();

    expect(new Set(state.paddles.map((paddle) => paddle.side))).toEqual(
      new Set(['left', 'right', 'top', 'bottom']),
    );
    expect(state.lives).toEqual([5, 5, 5, 5]);
  });

  it('creates multiple rackets per side for Superpong', () => {
    const state = engine('superpong').getState();

    expect(state.paddles).toHaveLength(4);
    expect(state.paddles.filter((paddle) => paddle.slot === 0)).toHaveLength(2);
  });

  it('applies gravity in Rebound', () => {
    const pong = engine('rebound');
    const before = pong.getState().balls[0]!.vy;

    pong.tick(100);

    expect(pong.getState().balls[0]!.vy).toBeGreaterThan(before);
  });

  it('creates destructible bricks in Breakout and brick battle', () => {
    expect(engine('breakout').getState().bricks.length).toBeGreaterThan(20);
    expect(engine('brick-battle').getState().bricks.length).toBeGreaterThan(0);
  });

  it('creates three independent balls in multiball', () => {
    const state = engine('multiball').getState();

    expect(state.balls).toHaveLength(3);
    expect(new Set(state.balls.map((ball) => ball.id)).size).toBe(3);
  });

  it('spawns a power-up after the configured interval', () => {
    const pong = engine('powerup-battle');

    for (let elapsed = 0; elapsed < 9000; elapsed += 100) pong.tick(100);

    expect(pong.getState().powerUps.length).toBeGreaterThan(0);
  });

  it('creates radial paddles for solo and duel', () => {
    expect(engine('radial-solo').getState().paddles).toHaveLength(1);
    expect(
      engine('radial-duel')
        .getState()
        .paddles.every((paddle) => paddle.orientation === 'radial'),
    ).toBe(true);
  });

  it('applies gravity and spin drift in Pong tennis', () => {
    const pong = engine('pong-tennis');
    (pong as any).state.balls[0].spin = 3;
    const before = pong.getState().balls[0]!;

    pong.tick(100);

    const after = pong.getState().balls[0]!;
    expect(after.vy).toBeGreaterThan(before.vy);
    expect(after.vx).not.toBe(before.vx);
  });

  it('creates four goals for air hockey and cooperative sides', () => {
    expect(engine('air-hockey').getState().paddles).toHaveLength(4);
    expect(engine('coop-keep-alive').getState().paddles).toHaveLength(4);
  });

  it('publishes survival time as the cooperative score', () => {
    const engine = new PongArenaEngine({ ruleset: 'coop-keep-alive' });

    engine.tick(3100);

    expect(engine.getState().score[0]).toBe(3);
  });

  it('moves a paddle toward a target without teleporting', () => {
    const pong = engine('classic-1v1');
    const before = pong.getState().paddles[0]!.axisPosition;
    pong.setInput(0, { axis: 0, target: 1, release: false });

    pong.tick(100);

    const after = pong.getState().paddles[0]!.axisPosition;
    expect(after).toBeGreaterThan(before);
    expect(after - before).toBeLessThanOrEqual(40.001);
  });
});
