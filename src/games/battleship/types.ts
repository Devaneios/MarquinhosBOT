export type BattleshipSide = 'p1' | 'p2';
export type ShipType =
  'carrier' | 'battleship' | 'cruiser' | 'submarine' | 'destroyer';
export type Orientation = 'horizontal' | 'vertical';
export type Phase = 'placement' | 'battle' | 'ended';

export const SHIP_SIZES: Record<ShipType, number> = {
  carrier: 5,
  battleship: 4,
  cruiser: 3,
  submarine: 3,
  destroyer: 2,
};

export const SHIP_ORDER: ShipType[] = [
  'carrier',
  'battleship',
  'cruiser',
  'submarine',
  'destroyer',
];

export const BOARD_SIZE = 10;

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

export interface BattleshipStateView {
  phase: Phase;
  turn: BattleshipSide | null;
  winner: BattleshipSide | null;
  own: BoardView;
  opponent: BoardView;
  placementReady: Record<BattleshipSide, boolean>;
}
