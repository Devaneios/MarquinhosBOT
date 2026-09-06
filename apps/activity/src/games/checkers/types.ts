export type GameMode = 'single' | 'multi';

export type Color = 'black' | 'red';

export interface Position {
  row: number;
  col: number;
}

export interface Piece {
  color: Color;
  king: boolean;
}

export type Board = (Piece | null)[][];

export interface CheckersState {
  board: Board;
  turn: Color;
  winner: Color | null;
  mustContinueFrom: Position | null;
}
