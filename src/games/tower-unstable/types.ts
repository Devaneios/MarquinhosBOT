// Mirrors TowerState in marquinhos-api's TowerEngine — kept as a hand
// written twin (like pongProtocol's snapshot shape) rather than a shared
// package, since the two repos don't share a type source.
export interface TowerLevelState {
  present: boolean[];
}

export interface TowerLastPull {
  level: number;
  position: number;
  instability: number;
  toppled: boolean;
  puller: string;
}

export interface TowerState {
  levels: TowerLevelState[];
  pendingBlocks: number;
  totalRemoved: number;
  totalBlocksOriginal: number;
  eligibleLevelCount: number;
  currentPlayer: string;
  turnOrder: string[];
  eliminated: string[];
  status: 'playing' | 'ended';
  winner: string | null;
  lastPull: TowerLastPull | null;
}
