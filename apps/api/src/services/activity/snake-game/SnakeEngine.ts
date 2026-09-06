export type SnakeDirection = 'up' | 'down' | 'left' | 'right';

export interface SnakeEngineConfig {
  width?: number;
  height?: number;
  initialSnakeLength?: number;
  foodSpawnRate?: number;
  winningScore?: number;
}

interface SnakeSegment {
  x: number;
  y: number;
}

interface SnakeBody {
  segments: SnakeSegment[];
  direction: SnakeDirection;
  nextDirection: SnakeDirection;
  alive: boolean;
}

export interface SnakeGameState {
  width: number;
  height: number;
  snakes: Record<string, SnakeBody>;
  food: SnakeSegment[];
  scores: Record<string, number>;
  winner: string | null;
}

export class SnakeEngine {
  private readonly config: Required<SnakeEngineConfig>;
  private state: SnakeGameState;

  constructor(config: SnakeEngineConfig = {}) {
    this.config = {
      width: config.width ?? 20,
      height: config.height ?? 20,
      initialSnakeLength: config.initialSnakeLength ?? 3,
      foodSpawnRate: config.foodSpawnRate ?? 0.1,
      winningScore: config.winningScore ?? 10,
    };
    this.state = this.initState();
  }

  private initState(): SnakeGameState {
    const midX = Math.floor(this.config.width / 2);
    const midY = Math.floor(this.config.height / 2);

    const segments: SnakeSegment[] = [];
    for (let i = 0; i < this.config.initialSnakeLength; i++) {
      segments.push({ x: midX - i, y: midY });
    }

    const snakes: Record<string, SnakeBody> = {
      player1: {
        segments,
        direction: 'right',
        nextDirection: 'right',
        alive: true,
      },
    };

    const initialState: SnakeGameState = {
      width: this.config.width,
      height: this.config.height,
      snakes,
      food: [],
      scores: { player1: 0 },
      winner: null,
    };

    const food = this.spawnFoodForState(initialState, 1);

    return {
      ...initialState,
      food,
    };
  }

  getConfig(): Readonly<Required<SnakeEngineConfig>> {
    return this.config;
  }

  getState(): SnakeGameState {
    return JSON.parse(JSON.stringify(this.state));
  }

  setDirection(playerId: string, direction: SnakeDirection): void {
    const snake = this.state.snakes[playerId];
    if (!snake || !snake.alive) return;

    const opposite = this.getOpposite(snake.direction);
    if (direction !== opposite) {
      snake.nextDirection = direction;
    }
  }

  private getOpposite(direction: SnakeDirection): SnakeDirection {
    const opposites: Record<SnakeDirection, SnakeDirection> = {
      up: 'down',
      down: 'up',
      left: 'right',
      right: 'left',
    };
    return opposites[direction];
  }

  tick(): void {
    if (this.state.winner) return;

    for (const playerId in this.state.snakes) {
      this.moveSnake(playerId);
      this.checkCollisions(playerId);
    }

    this.checkFoodCollisions();
    this.spawnFoodIfNeeded();
  }

  private moveSnake(playerId: string): void {
    const snake = this.state.snakes[playerId];
    if (!snake || !snake.alive) return;

    snake.direction = snake.nextDirection;
    const head = snake.segments[0]!;
    const newHead = this.movePoint(head, snake.direction);

    snake.segments.unshift(newHead);
    snake.segments.pop();
  }

  private movePoint(
    point: SnakeSegment,
    direction: SnakeDirection,
  ): SnakeSegment {
    const directionMap: Record<SnakeDirection, { dx: number; dy: number }> = {
      up: { dx: 0, dy: -1 },
      down: { dx: 0, dy: 1 },
      left: { dx: -1, dy: 0 },
      right: { dx: 1, dy: 0 },
    };
    const delta = directionMap[direction];
    return {
      x: point.x + delta.dx,
      y: point.y + delta.dy,
    };
  }

  private checkCollisions(playerId: string): void {
    const snake = this.state.snakes[playerId];
    if (!snake || !snake.alive) return;

    const head = snake.segments[0]!;

    if (
      head.x < 0 ||
      head.x >= this.config.width ||
      head.y < 0 ||
      head.y >= this.config.height
    ) {
      snake.alive = false;
      this.checkGameEnd();
      return;
    }

    for (let i = 1; i < snake.segments.length; i++) {
      const segment = snake.segments[i]!;
      if (head.x === segment.x && head.y === segment.y) {
        snake.alive = false;
        this.checkGameEnd();
        return;
      }
    }

    for (const otherId in this.state.snakes) {
      if (otherId === playerId) continue;
      const otherSnake = this.state.snakes[otherId]!;
      for (const segment of otherSnake.segments) {
        if (head.x === segment.x && head.y === segment.y) {
          snake.alive = false;
          this.checkGameEnd();
          return;
        }
      }
    }
  }

  private checkGameEnd(): void {
    const alive = Object.entries(this.state.snakes).filter(
      ([_, snake]) => snake.alive,
    );

    if (alive.length === 0) {
      this.state.winner = null;
    } else if (alive.length === 1) {
      this.state.winner = alive[0]![0];
    }
  }

  private checkFoodCollisions(): void {
    for (const playerId in this.state.snakes) {
      const snake = this.state.snakes[playerId];
      if (!snake || !snake.alive) continue;

      const head = snake.segments[0]!;
      const foodIndex = this.state.food.findIndex(
        (f) => f.x === head.x && f.y === head.y,
      );

      if (foodIndex !== -1) {
        this.state.food.splice(foodIndex, 1);
        const tail = snake.segments[snake.segments.length - 1]!;
        snake.segments.push({ ...tail });
        this.state.scores[playerId] = (this.state.scores[playerId] ?? 0) + 1;

        if (this.state.scores[playerId]! >= this.config.winningScore) {
          this.state.winner = playerId;
        }
      }
    }
  }

  private spawnFoodIfNeeded(): void {
    if (
      Math.random() < this.config.foodSpawnRate &&
      this.state.food.length < 2
    ) {
      const food = this.spawnFoodForState(this.state, 1);
      this.state.food.push(...food);
    }
  }

  private spawnFoodForState(
    state: SnakeGameState,
    count: number,
  ): SnakeSegment[] {
    const occupied = new Set<string>();

    for (const snake of Object.values(state.snakes)) {
      for (const segment of snake.segments) {
        occupied.add(`${segment.x},${segment.y}`);
      }
    }

    for (const food of state.food) {
      occupied.add(`${food.x},${food.y}`);
    }

    const food: SnakeSegment[] = [];
    let attempts = 0;
    const maxAttempts = 100;

    while (food.length < count && attempts < maxAttempts) {
      const x = Math.floor(Math.random() * this.config.width);
      const y = Math.floor(Math.random() * this.config.height);
      const key = `${x},${y}`;

      if (!occupied.has(key)) {
        food.push({ x, y });
        occupied.add(key);
      }
      attempts++;
    }

    return food;
  }

  reset(): void {
    this.state = this.initState();
  }

  forceWinner(playerId: string): void {
    if (this.state.winner) return;
    this.state.winner = playerId;
  }

  addSnake(playerId: string): void {
    if (this.state.snakes[playerId]) return;

    const segments: SnakeSegment[] = [];
    const midX = Math.floor(this.config.width / 2);
    const offsetY = Object.keys(this.state.snakes).length * 3;
    const midY = Math.floor(this.config.height / 2) + offsetY;

    for (let i = 0; i < this.config.initialSnakeLength; i++) {
      segments.push({ x: midX - i, y: midY });
    }

    this.state.snakes[playerId] = {
      segments,
      direction: 'right',
      nextDirection: 'right',
      alive: true,
    };
    this.state.scores[playerId] = 0;
  }
}
