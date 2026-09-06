import { describe, expect, it } from 'bun:test';
import {
  SnakeEngine,
  type SnakeDirection,
  type SnakeGameState,
} from 'services/activity/snake-game/SnakeEngine';

function getMutableState(engine: SnakeEngine): SnakeGameState {
  return (engine as unknown as { state: SnakeGameState }).state;
}

const CONFIG = {
  width: 20,
  height: 20,
  initialSnakeLength: 3,
  foodSpawnRate: 0.1,
  winningScore: 10,
};

describe('SnakeEngine', () => {
  it('initializes with correct grid dimensions and single snake at center', () => {
    const engine = new SnakeEngine(CONFIG);
    const state = engine.getState();

    expect(state.width).toBe(20);
    expect(state.height).toBe(20);
    expect(state.snakes['player1']).toBeDefined();
    expect(state.snakes['player1']!.segments.length).toBe(3);
    expect(state.snakes['player1']!.direction).toBe('right');
    expect(state.winner).toBeNull();
  });

  it('moves snake forward each tick in the set direction', () => {
    const engine = new SnakeEngine(CONFIG);
    const before = engine.getState();
    const headBefore = { ...before.snakes['player1']!.segments[0]! };

    engine.tick();

    const after = engine.getState();
    const headAfter = after.snakes['player1']!.segments[0]!;

    expect(headAfter.x).toBe(headBefore.x + 1);
  });

  it('rejects direction change that would reverse into self', () => {
    const engine = new SnakeEngine(CONFIG);
    engine.setDirection('player1', 'left');

    const state = engine.getState();
    expect(state.snakes['player1']!.direction).toBe('right');
  });

  it('grows snake when eating food', () => {
    const engine = new SnakeEngine(CONFIG);
    const state = engine.getState();

    state.snakes['player1']!.segments[0] = { x: 10, y: 10 };
    state.food = [{ x: 11, y: 10 }];
    Object.assign(getMutableState(engine), state);

    const lengthBefore = state.snakes['player1']!.segments.length;
    const scoreBefore = state.scores['player1']!;

    engine.tick();

    const after = engine.getState();
    expect(after.snakes['player1']!.segments.length).toBeGreaterThan(
      lengthBefore,
    );
    expect(after.scores['player1']!).toBeGreaterThan(scoreBefore);
  });

  it('respawns food after it is eaten', () => {
    const engine = new SnakeEngine(CONFIG);
    getMutableState(engine).food = [{ x: 10, y: 10 }];

    const initialCount = getMutableState(engine).food.length;

    engine.tick();

    const after = engine.getState();
    expect(after.food.length).toBe(initialCount);
  });

  it('declares winner when a snake reaches winning score', () => {
    const engine = new SnakeEngine(CONFIG);
    getMutableState(engine).scores['player1'] = CONFIG.winningScore - 1;

    getMutableState(engine).snakes['player1']!.segments[0] = { x: 10, y: 10 };
    getMutableState(engine).food = [{ x: 11, y: 10 }];

    engine.tick();

    const state = engine.getState();
    expect(state.winner).toBe('player1');
  });

  it('ends game when snake collides with wall', () => {
    const engine = new SnakeEngine(CONFIG);
    getMutableState(engine).snakes['player1'] = {
      segments: [
        { x: 0, y: 10 },
        { x: 1, y: 10 },
        { x: 2, y: 10 },
      ],
      direction: 'left' as SnakeDirection,
      nextDirection: 'left' as SnakeDirection,
      alive: true,
    };

    engine.tick();

    const state = engine.getState();
    expect(state.snakes['player1']!.alive).toBe(false);
  });

  it('reset clears snakes, food, and scores', () => {
    const engine = new SnakeEngine(CONFIG);
    getMutableState(engine).scores['player1'] = 5;

    engine.reset();

    const state = engine.getState();
    expect(state.scores['player1']).toBe(0);
    expect(state.winner).toBeNull();
  });

  it('handles two-player snakes correctly', () => {
    const engine = new SnakeEngine(CONFIG);
    engine.addSnake('player2');

    const state = engine.getState();
    expect(state.snakes['player1']).toBeDefined();
    expect(state.snakes['player2']).toBeDefined();
    expect(state.scores['player2']).toBe(0);
  });

  it('detects collision between two snakes', () => {
    const engine = new SnakeEngine(CONFIG);
    engine.addSnake('player2');

    getMutableState(engine).snakes['player1']!.segments = [
      { x: 10, y: 10 },
      { x: 9, y: 10 },
    ];
    getMutableState(engine).snakes['player1']!.direction = 'right';
    getMutableState(engine).snakes['player1']!.nextDirection = 'right';

    getMutableState(engine).snakes['player2']!.segments = [
      { x: 12, y: 10 },
      { x: 13, y: 10 },
    ];
    getMutableState(engine).snakes['player2']!.direction = 'left';
    getMutableState(engine).snakes['player2']!.nextDirection = 'left';

    engine.tick();

    const state = engine.getState();
    expect(state.snakes['player2']!.alive).toBe(false);
  });
});
