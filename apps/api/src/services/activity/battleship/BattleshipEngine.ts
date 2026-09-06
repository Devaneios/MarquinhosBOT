export type BattleshipSide = 'p1' | 'p2';
export type ShipType =
  'carrier' | 'battleship' | 'cruiser' | 'submarine' | 'destroyer';
export type Orientation = 'horizontal' | 'vertical';

export const BOARD_SIZE = 10;

export const SHIP_SIZES: Record<ShipType, number> = {
  carrier: 5,
  battleship: 4,
  cruiser: 3,
  submarine: 3,
  destroyer: 2,
};

const SHIP_TYPES = Object.keys(SHIP_SIZES) as ShipType[];

export interface Coordinate {
  x: number;
  y: number;
}

export interface ShipPlacement {
  type: ShipType;
  x: number;
  y: number;
  orientation: Orientation;
}

export interface Ship {
  type: ShipType;
  cells: Coordinate[];
  hitCells: Set<string>;
}

export interface Shot {
  x: number;
  y: number;
  hit: boolean;
  shipIndex?: number;
}

export interface PlayerBoard {
  ships: Ship[];
  shotsReceived: Shot[];
  placed: boolean;
}

export type Phase = 'placement' | 'battle' | 'ended';

export interface PlaceShipsResult {
  ok: boolean;
  error?: string;
}

export interface FireResult {
  ok: boolean;
  error?: string;
  hit?: boolean;
  sunk?: ShipType;
  winner?: BattleshipSide;
}

function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}

function otherSide(side: BattleshipSide): BattleshipSide {
  return side === 'p1' ? 'p2' : 'p1';
}

// Pure derivation from a validated placement — the caller (validatePlacements)
// is the only place that decides whether a placement is legal; this just
// expands it into cells once that's already been decided.
function cellsFor(placement: ShipPlacement, size: number): Coordinate[] {
  const cells: Coordinate[] = [];
  for (let i = 0; i < size; i++) {
    cells.push(
      placement.orientation === 'horizontal'
        ? { x: placement.x + i, y: placement.y }
        : { x: placement.x, y: placement.y + i },
    );
  }
  return cells;
}

// The one place placement legality is decided: right ship set, in bounds,
// non-overlapping. Orientation is a closed enum ('horizontal' | 'vertical')
// so diagonal placement is unrepresentable rather than something to reject.
function validatePlacements(
  placements: ShipPlacement[],
): { ok: true; ships: Ship[] } | { ok: false; error: string } {
  if (placements.length !== SHIP_TYPES.length) {
    return { ok: false, error: 'Must place exactly 5 ships' };
  }
  const seenTypes = new Set<ShipType>();
  const occupied = new Set<string>();
  const ships: Ship[] = [];

  for (const placement of placements) {
    const size = SHIP_SIZES[placement.type];
    if (size === undefined) {
      return { ok: false, error: `Unknown ship type: ${placement.type}` };
    }
    if (seenTypes.has(placement.type)) {
      return { ok: false, error: `Duplicate ship type: ${placement.type}` };
    }
    seenTypes.add(placement.type);

    if (
      placement.orientation !== 'horizontal' &&
      placement.orientation !== 'vertical'
    ) {
      return { ok: false, error: 'Invalid orientation' };
    }

    const cells = cellsFor(placement, size);
    for (const cell of cells) {
      if (
        cell.x < 0 ||
        cell.x >= BOARD_SIZE ||
        cell.y < 0 ||
        cell.y >= BOARD_SIZE
      ) {
        return { ok: false, error: `${placement.type} is out of bounds` };
      }
      const key = cellKey(cell.x, cell.y);
      if (occupied.has(key)) {
        return { ok: false, error: `${placement.type} overlaps another ship` };
      }
      occupied.add(key);
    }

    ships.push({ type: placement.type, cells, hitCells: new Set() });
  }

  if (seenTypes.size !== SHIP_TYPES.length) {
    return { ok: false, error: 'Must place one of each ship type' };
  }

  return { ok: true, ships };
}

function isShipSunk(ship: Ship): boolean {
  return ship.hitCells.size === ship.cells.length;
}

// Server-authoritative rules engine. Holds both players' boards; nothing in
// here ever hands a caller the opposing board's ship layout — that boundary
// lives in maskBoard(), which is the only thing allowed to read `ships` for
// an opponent view.
export class BattleshipEngine {
  private boards: Record<BattleshipSide, PlayerBoard> = {
    p1: { ships: [], shotsReceived: [], placed: false },
    p2: { ships: [], shotsReceived: [], placed: false },
  };
  private phase: Phase = 'placement';
  private turn: BattleshipSide = 'p1';
  private winner: BattleshipSide | null = null;

  getPhase(): Phase {
    return this.phase;
  }

  getTurn(): BattleshipSide | null {
    return this.phase === 'battle' ? this.turn : null;
  }

  getWinner(): BattleshipSide | null {
    return this.winner;
  }

  isPlaced(side: BattleshipSide): boolean {
    return this.boards[side].placed;
  }

  placeShips(
    side: BattleshipSide,
    placements: ShipPlacement[],
  ): PlaceShipsResult {
    if (this.phase !== 'placement') {
      return { ok: false, error: 'Placement is closed' };
    }
    if (this.boards[side].placed) {
      return { ok: false, error: 'Already placed ships' };
    }

    const result = validatePlacements(placements);
    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    this.boards[side] = {
      ships: result.ships,
      shotsReceived: [],
      placed: true,
    };

    if (this.boards.p1.placed && this.boards.p2.placed) {
      this.phase = 'battle';
    }

    return { ok: true };
  }

  fire(side: BattleshipSide, x: number, y: number): FireResult {
    if (this.phase !== 'battle') {
      return { ok: false, error: 'Firing is not open yet' };
    }
    if (this.turn !== side) {
      return { ok: false, error: 'Not your turn' };
    }
    if (
      !Number.isInteger(x) ||
      !Number.isInteger(y) ||
      x < 0 ||
      x >= BOARD_SIZE ||
      y < 0 ||
      y >= BOARD_SIZE
    ) {
      return { ok: false, error: 'Coordinate out of bounds' };
    }

    const targetSide = otherSide(side);
    const board = this.boards[targetSide];
    if (board.shotsReceived.some((s) => s.x === x && s.y === y)) {
      return { ok: false, error: 'Already fired at this coordinate' };
    }

    const shipIndex = board.ships.findIndex((ship) =>
      ship.cells.some((c) => c.x === x && c.y === y),
    );
    const hit = shipIndex !== -1;
    let sunk: ShipType | undefined;

    if (hit) {
      const ship = board.ships[shipIndex]!;
      ship.hitCells.add(cellKey(x, y));
      if (isShipSunk(ship)) sunk = ship.type;
    }

    board.shotsReceived.push({
      x,
      y,
      hit,
      shipIndex: hit ? shipIndex : undefined,
    });

    const allSunk = board.ships.every((ship) => isShipSunk(ship));
    if (allSunk) {
      this.phase = 'ended';
      this.winner = side;
    } else {
      this.turn = targetSide;
    }

    return {
      ok: true,
      hit,
      sunk,
      winner: this.winner ?? undefined,
    };
  }

  // Used to settle a match when an opponent forfeits (disconnect grace
  // expiry, explicit leave mid-battle) rather than by sinking every ship.
  forceWinner(side: BattleshipSide) {
    if (this.phase === 'ended') return;
    this.phase = 'ended';
    this.winner = side;
  }

  getBoardSnapshot(side: BattleshipSide) {
    return this.boards[side];
  }
}
