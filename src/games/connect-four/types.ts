export type GameMode = 'single' | 'multi';
export type Disc = 'p1' | 'p2';

export interface ConnectFourState {
  grid: (Disc | null)[][];
  currentTurn: Disc;
  winner: Disc | null;
  winningLine: Array<{ row: number; col: number }> | null;
  isDraw: boolean;
}
