import type { BoardSnapshot, RevealPayload } from './protocol';

export function applyRevealToBoard(
  board: BoardSnapshot,
  payload: RevealPayload,
): BoardSnapshot {
  const grid = board.grid.map((row) => row.slice());
  for (const tile of payload.revealedTiles) {
    const row = grid[tile.y];
    if (!row) continue;
    row[tile.x] = {
      revealed: true,
      mine: tile.mine,
      adjacent: tile.adjacent,
      revealedBy: tile.revealedBy,
    };
  }
  return {
    ...board,
    grid,
    scores: payload.scores,
    gameOver: payload.gameOver,
  };
}
