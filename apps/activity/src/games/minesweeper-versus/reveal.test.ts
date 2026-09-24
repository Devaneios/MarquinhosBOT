import {
  boardSnapshotSchema,
  revealPayloadSchema,
} from '@marquinhos/contracts/activity/games/minesweeperVersus';
import { describe, expect, it } from 'bun:test';
import { applyRevealToBoard } from './reveal';

describe('applyRevealToBoard', () => {
  it('applies a validated reveal without mutating the previous board', () => {
    const board = boardSnapshotSchema.parse({
      width: 2,
      height: 1,
      grid: [[{ revealed: false }, { revealed: false }]],
      scores: { player: 0 },
      gameOver: false,
    });
    const payload = revealPayloadSchema.parse({
      userId: 'player',
      revealedTiles: [
        { x: 1, y: 0, mine: false, adjacent: 1, revealedBy: 'player' },
      ],
      pointsDelta: 1,
      hitMine: false,
      gameOver: false,
      scores: { player: 1 },
    });

    const next = applyRevealToBoard(board, payload);
    expect(next.grid[0][1]).toEqual({
      revealed: true,
      mine: false,
      adjacent: 1,
      revealedBy: 'player',
    });
    expect(next.scores).toEqual({ player: 1 });
    expect(board.grid[0][1]).toEqual({ revealed: false });
  });
});
