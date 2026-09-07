import {
  BOARD_SIZE,
  SHIP_SIZES,
  type Coordinate,
  type Orientation,
  type ShipPlacement,
  type ShipType,
} from 'services/activity/battleship/BattleshipEngine';

const SHIP_TYPES = Object.keys(SHIP_SIZES) as ShipType[];

function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}

function inBounds(c: Coordinate): boolean {
  return c.x >= 0 && c.x < BOARD_SIZE && c.y >= 0 && c.y < BOARD_SIZE;
}

// Random valid fleet — retries a fresh (type, x, y, orientation) draw
// whenever a placement collides or falls off the board, same shape the
// engine's own validatePlacements() accepts.
function randomPlacements(): ShipPlacement[] {
  const occupied = new Set<string>();
  const placements: ShipPlacement[] = [];

  for (const type of SHIP_TYPES) {
    const size = SHIP_SIZES[type];

    while (true) {
      const orientation: Orientation =
        Math.random() < 0.5 ? 'horizontal' : 'vertical';
      const x = Math.floor(Math.random() * BOARD_SIZE);
      const y = Math.floor(Math.random() * BOARD_SIZE);
      const cells: Coordinate[] = [];
      let ok = true;

      for (let i = 0; i < size; i++) {
        const cell: Coordinate =
          orientation === 'horizontal' ? { x: x + i, y } : { x, y: y + i };
        if (!inBounds(cell) || occupied.has(cellKey(cell.x, cell.y))) {
          ok = false;
          break;
        }
        cells.push(cell);
      }

      if (!ok) continue;
      for (const cell of cells) occupied.add(cellKey(cell.x, cell.y));
      placements.push({ type, x, y, orientation });
      break;
    }
  }

  return placements;
}

// Classic hunt/target Battleship AI: fire randomly until a hit, then queue
// the four neighbors and work through them until the ship sinks.
export class BattleshipBot {
  private shotsFired = new Set<string>();
  private targetQueue: Coordinate[] = [];

  generatePlacements(): ShipPlacement[] {
    return randomPlacements();
  }

  chooseShot(): Coordinate | null {
    while (this.targetQueue.length > 0) {
      const next = this.targetQueue.shift()!;
      if (inBounds(next) && !this.shotsFired.has(cellKey(next.x, next.y))) {
        return next;
      }
    }

    const remaining: Coordinate[] = [];
    for (let x = 0; x < BOARD_SIZE; x++) {
      for (let y = 0; y < BOARD_SIZE; y++) {
        if (!this.shotsFired.has(cellKey(x, y))) remaining.push({ x, y });
      }
    }
    if (remaining.length === 0) return null;
    return remaining[Math.floor(Math.random() * remaining.length)]!;
  }

  recordResult(shot: Coordinate, hit: boolean, sunk: boolean): void {
    this.shotsFired.add(cellKey(shot.x, shot.y));
    if (sunk) {
      // A sunk ship can't still be dragging a neighbor queue around —
      // whatever's queued belonged to this ship's hunt.
      this.targetQueue = [];
    } else if (hit) {
      this.targetQueue.push(
        { x: shot.x + 1, y: shot.y },
        { x: shot.x - 1, y: shot.y },
        { x: shot.x, y: shot.y + 1 },
        { x: shot.x, y: shot.y - 1 },
      );
    }
  }
}
