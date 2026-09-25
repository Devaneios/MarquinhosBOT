import type {
  SnakeDirection,
  SnakeGameState,
  SnakePublicConfig,
  SnakeSegment,
} from '@marquinhos/contracts/activity/games/snakeGame';
import { Graphics } from 'pixi.js';

export const CELL_SIZE = 20;
export const BG_COLOR = '#000000';
const GRID_COLOR = '#222222';
const SNAKE_COLORS: Record<string, number> = {
  player1: 0x00ff00,
  player2: 0xffff00,
};
const FALLBACK_SNAKE_COLOR = 0x888888;
const FOOD_COLOR = '#ff0000';
// Server ticks (and broadcasts state) at ~150ms (FIXED_DT_MS in
// SnakeSession); a slightly shorter interpolation window keeps the render
// from visibly lagging behind fresh input on direction changes.
export const INTERP_MS = 120;
// A segment moving more than one cell between snapshots is a wrap-around
// (or a respawn), not continuous motion — lerping that would draw a snake
// sliding diagonally across the whole board, so snap instead.
const MAX_LERP_CELLS = 1;

export const KEY_TO_DIRECTION: Record<string, SnakeDirection> = {
  arrowup: 'up',
  w: 'up',
  arrowdown: 'down',
  s: 'down',
  arrowleft: 'left',
  a: 'left',
  arrowright: 'right',
  d: 'right',
};

export function drawGrid(gfx: Graphics, config: SnakePublicConfig) {
  gfx.clear();
  for (let x = 0; x <= config.width; x++) {
    gfx
      .moveTo(x * CELL_SIZE, 0)
      .lineTo(x * CELL_SIZE, config.height * CELL_SIZE);
  }
  for (let y = 0; y <= config.height; y++) {
    gfx
      .moveTo(0, y * CELL_SIZE)
      .lineTo(config.width * CELL_SIZE, y * CELL_SIZE);
  }
  gfx.stroke({ width: 1, color: GRID_COLOR });
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function lerpSegment(
  prev: SnakeSegment,
  latest: SnakeSegment,
  t: number,
): SnakeSegment {
  if (
    Math.abs(latest.x - prev.x) > MAX_LERP_CELLS ||
    Math.abs(latest.y - prev.y) > MAX_LERP_CELLS
  ) {
    return latest;
  }
  return { x: lerp(prev.x, latest.x, t), y: lerp(prev.y, latest.y, t) };
}

export function drawEntities(
  gfx: Graphics,
  state: SnakeGameState,
  prevState: SnakeGameState | null,
  t: number,
) {
  gfx.clear();
  for (const [id, snake] of Object.entries(state.snakes)) {
    const color = SNAKE_COLORS[id] ?? FALLBACK_SNAKE_COLOR;
    const prevSnake = prevState?.snakes[id];
    for (let i = 0; i < snake.segments.length; i++) {
      const segment = snake.segments[i];
      const prevSegment = prevSnake?.segments[i];
      const { x, y } = prevSegment
        ? lerpSegment(prevSegment, segment, t)
        : segment;
      gfx
        .rect(
          x * CELL_SIZE + 1,
          y * CELL_SIZE + 1,
          CELL_SIZE - 2,
          CELL_SIZE - 2,
        )
        .fill(color);
    }
  }
  for (const food of state.food) {
    gfx
      .rect(
        food.x * CELL_SIZE + 5,
        food.y * CELL_SIZE + 5,
        CELL_SIZE - 10,
        CELL_SIZE - 10,
      )
      .fill(FOOD_COLOR);
  }
}
