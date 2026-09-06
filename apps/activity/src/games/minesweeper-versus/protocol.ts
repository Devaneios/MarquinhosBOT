export interface PublicCell {
  revealed: boolean;
  mine?: boolean;
  adjacent?: number;
  revealedBy?: string | null;
}

export interface BoardSnapshot {
  width: number;
  height: number;
  grid: PublicCell[][];
  scores: Record<string, number>;
  gameOver: boolean;
}

export interface RevealedTile {
  x: number;
  y: number;
  mine: boolean;
  adjacent: number;
  revealedBy: string;
}

export interface RevealPayload {
  userId: string;
  revealedTiles: RevealedTile[];
  pointsDelta: number;
  hitMine: boolean;
  gameOver: boolean;
  scores: Record<string, number>;
}

export interface GameOverPayload {
  scores: Record<string, number>;
}
