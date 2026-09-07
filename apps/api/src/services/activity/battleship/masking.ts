import type {
  BattleshipSide,
  Coordinate,
  PlayerBoard,
  Ship,
  ShipType,
} from 'services/activity/battleship/BattleshipEngine';

export interface ShipView {
  type: ShipType;
  cells: Coordinate[];
  sunk: boolean;
}

export interface ShotView {
  x: number;
  y: number;
  hit: boolean;
  shipType?: ShipType;
  sunk?: boolean;
}

export interface BoardView {
  ships: ShipView[];
  shots: ShotView[];
}

function shipSunk(ship: Ship): boolean {
  return ship.hitCells.size === ship.cells.length;
}

// THE masking function for battleship. A viewer's own board is always shown
// in full; an opponent's board only ever exposes ship *positions* once that
// ship is sunk (every one of its cells is already a known hit, so sinking
// leaks nothing a hit history didn't already reveal) or once the whole match
// has ended. This is the only place opposing `ships` is read for a view —
// every other consumer must go through here, exactly as cards/core/masking.ts
// is the only place a hidden card gets revealed.
export function maskBoard(
  board: PlayerBoard,
  { isOwner, gameEnded }: { isOwner: boolean; gameEnded: boolean },
): BoardView {
  const revealAllShips = isOwner || gameEnded;

  return {
    ships: board.ships
      .filter((ship) => revealAllShips || shipSunk(ship))
      .map((ship) => ({
        type: ship.type,
        cells: ship.cells,
        sunk: shipSunk(ship),
      })),
    shots: board.shotsReceived.map((shot) => {
      const ship = shot.hit ? board.ships[shot.shipIndex!] : undefined;
      return {
        x: shot.x,
        y: shot.y,
        hit: shot.hit,
        shipType: ship?.type,
        sunk: ship ? shipSunk(ship) : undefined,
      };
    }),
  };
}

export interface BattleshipStateView {
  phase: 'placement' | 'battle' | 'ended';
  turn: BattleshipSide | null;
  winner: BattleshipSide | null;
  own: BoardView;
  opponent: BoardView;
  placementReady: Record<BattleshipSide, boolean>;
}

export interface BattleshipSpectatorStateView {
  phase: 'placement' | 'battle' | 'ended';
  turn: BattleshipSide | null;
  winner: BattleshipSide | null;
  p1: BoardView;
  p2: BoardView;
  placementReady: Record<BattleshipSide, boolean>;
}

function otherSide(side: BattleshipSide): BattleshipSide {
  return side === 'p1' ? 'p2' : 'p1';
}

// Assembles the one thing a client's `state` message ever carries: this
// viewer's own board in full, and the opponent's board through maskBoard().
// There is deliberately no lower-level accessor a Session/Room could reach
// for instead — going around this function is exactly how an opponent's
// live ship layout would leak.
export function viewFor(
  engine: {
    getPhase(): BattleshipStateView['phase'];
    getTurn(): BattleshipSide | null;
    getWinner(): BattleshipSide | null;
    isPlaced(side: BattleshipSide): boolean;
    getBoardSnapshot(side: BattleshipSide): PlayerBoard;
  },
  viewer: BattleshipSide,
): BattleshipStateView {
  const phase = engine.getPhase();
  const gameEnded = phase === 'ended';
  const opponent = otherSide(viewer);

  return {
    phase,
    turn: engine.getTurn(),
    winner: engine.getWinner(),
    own: maskBoard(engine.getBoardSnapshot(viewer), {
      isOwner: true,
      gameEnded,
    }),
    opponent: maskBoard(engine.getBoardSnapshot(opponent), {
      isOwner: false,
      gameEnded,
    }),
    placementReady: {
      p1: engine.isPlaced('p1'),
      p2: engine.isPlaced('p2'),
    },
  };
}

// A non-participant gets a symmetric fully-masked view — neither fleet is
// revealed (same shipSunk/gameEnded rule maskBoard already applies to an
// opponent's board), since a spectator has no "own" side to see in full.
export function spectatorViewFor(engine: {
  getPhase(): BattleshipSpectatorStateView['phase'];
  getTurn(): BattleshipSide | null;
  getWinner(): BattleshipSide | null;
  isPlaced(side: BattleshipSide): boolean;
  getBoardSnapshot(side: BattleshipSide): PlayerBoard;
}): BattleshipSpectatorStateView {
  const phase = engine.getPhase();
  const gameEnded = phase === 'ended';

  return {
    phase,
    turn: engine.getTurn(),
    winner: engine.getWinner(),
    p1: maskBoard(engine.getBoardSnapshot('p1'), { isOwner: false, gameEnded }),
    p2: maskBoard(engine.getBoardSnapshot('p2'), { isOwner: false, gameEnded }),
    placementReady: {
      p1: engine.isPlaced('p1'),
      p2: engine.isPlaced('p2'),
    },
  };
}
