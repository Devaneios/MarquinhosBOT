import type {
  SnakeDirection,
  SnakeGameState,
} from 'services/activity/snake-game/SnakeEngine';

interface Point {
  x: number;
  y: number;
}

const DIRECTIONS: SnakeDirection[] = ['up', 'down', 'left', 'right'];

const DELTAS: Record<SnakeDirection, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITES: Record<SnakeDirection, SnakeDirection> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

// `single` mode has no human opponent to race against — without a bot it's
// just an empty board with a second, permanently-idle snake slot (spec
// migration item 3). Greedy chase: at every tick, of the directions that
// don't reverse into its own neck and don't immediately collide with a
// wall, itself, or another snake, pick whichever gets closest (Manhattan
// distance) to the nearest food. No lookahead — good enough for a practice
// opponent, not a puzzle solver.
export class SnakeBot {
  constructor(private readonly playerId: string) {}

  chooseDirection(state: SnakeGameState): SnakeDirection {
    const snake = state.snakes[this.playerId];
    if (!snake || !snake.alive) return 'right';

    const head = snake.segments[0]!;
    const target = this.nearestFood(state, head);
    const occupied = this.occupiedCells(state);

    let best: SnakeDirection | null = null;
    let bestScore = Infinity;

    for (const dir of DIRECTIONS) {
      if (dir === OPPOSITES[snake.direction]) continue;
      const delta = DELTAS[dir];
      const next = { x: head.x + delta.x, y: head.y + delta.y };
      if (this.isUnsafe(next, state, occupied)) continue;

      const score = target
        ? Math.abs(next.x - target.x) + Math.abs(next.y - target.y)
        : 0;
      if (score < bestScore) {
        bestScore = score;
        best = dir;
      }
    }

    // Every direction is unsafe (boxed in) — keep going straight rather
    // than reversing into itself; the collision is unavoidable either way.
    return best ?? snake.direction;
  }

  private nearestFood(state: SnakeGameState, from: Point): Point | null {
    let nearest: Point | null = null;
    let nearestDist = Infinity;
    for (const food of state.food) {
      const dist = Math.abs(food.x - from.x) + Math.abs(food.y - from.y);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = food;
      }
    }
    return nearest;
  }

  private occupiedCells(state: SnakeGameState): Set<string> {
    const occupied = new Set<string>();
    for (const snake of Object.values(state.snakes)) {
      if (!snake.alive) continue;
      for (const segment of snake.segments) {
        occupied.add(`${segment.x},${segment.y}`);
      }
    }
    return occupied;
  }

  private isUnsafe(
    point: Point,
    state: SnakeGameState,
    occupied: Set<string>,
  ): boolean {
    if (
      point.x < 0 ||
      point.x >= state.width ||
      point.y < 0 ||
      point.y >= state.height
    ) {
      return true;
    }
    return occupied.has(`${point.x},${point.y}`);
  }
}
