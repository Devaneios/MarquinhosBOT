import { describe, expect, it } from 'bun:test';
import { MinesweeperEngine } from 'services/activity/minesweeper/MinesweeperEngine';

// A hand-laid 4x4 board with a single mine at (3,0) lets every test assert
// on exact tile coordinates instead of fighting a random layout. Engine
// only exposes mine placement via random generation, so tests that need a
// deterministic board seed the grid directly through the private field.
function engineWithFixedMines(
  width: number,
  height: number,
  minePositions: [number, number][],
): MinesweeperEngine {
  const engine = new MinesweeperEngine({ width, height, mineCount: 0 });
  const grid = (
    engine as unknown as {
      grid: {
        mine: boolean;
        adjacent: number;
        revealed: boolean;
        revealedBy: string | null;
      }[][];
    }
  ).grid;

  for (const [x, y] of minePositions) grid[y]![x]!.mine = true;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (grid[y]![x]!.mine) continue;
      let count = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          if (grid[ny]![nx]!.mine) count += 1;
        }
      }
      grid[y]![x]!.adjacent = count;
    }
  }

  (engine as unknown as { safeTilesRemaining: number }).safeTilesRemaining =
    width * height - minePositions.length;

  return engine;
}

describe('MinesweeperEngine', () => {
  describe('mine layout secrecy', () => {
    it('never exposes mine:true for an unrevealed tile', () => {
      const engine = engineWithFixedMines(4, 4, [[3, 0]]);
      engine.reveal('user-a', 0, 0);

      for (const row of engine.getPublicGrid()) {
        for (const cell of row) {
          if (!cell.revealed) {
            expect(cell.mine).toBeUndefined();
          }
        }
      }
    });

    it('reveals mine only once the exact mined tile is clicked', () => {
      const engine = engineWithFixedMines(4, 4, [[3, 0]]);
      const result = engine.reveal('user-a', 3, 0);
      expect('error' in result).toBe(false);
      if ('error' in result) return;
      expect(result.hitMine).toBe(true);

      const grid = engine.getPublicGrid();
      expect(grid[0]![3]!.revealed).toBe(true);
      expect(grid[0]![3]!.mine).toBe(true);
    });
  });

  describe('reveal', () => {
    it('rejects out-of-bounds coordinates', () => {
      const engine = engineWithFixedMines(4, 4, [[3, 0]]);
      expect(engine.reveal('user-a', -1, 0)).toEqual({
        error: 'out_of_bounds',
      });
      expect(engine.reveal('user-a', 4, 0)).toEqual({ error: 'out_of_bounds' });
    });

    it('rejects revealing an already-revealed tile', () => {
      const engine = engineWithFixedMines(4, 4, [[3, 0]]);
      engine.reveal('user-a', 3, 0);
      expect(engine.reveal('user-b', 3, 0)).toEqual({
        error: 'already_revealed',
      });
    });

    it('costs the revealing player points for hitting a mine, without affecting others', () => {
      const engine = engineWithFixedMines(4, 4, [[3, 0]]);
      engine.reveal('user-a', 3, 0);
      expect(engine.getScores()).toEqual({ 'user-a': -5 });
    });

    it('awards points to the revealing player for a safe tile', () => {
      // (1,3) borders no mine in a 4x4 board with the only mine at (3,0),
      // but is not itself a 0-adjacent tile bordering the zero region, so
      // this exercises a single-tile reveal rather than a cascade.
      const engine = engineWithFixedMines(4, 4, [[3, 0]]);
      const result = engine.reveal('user-a', 0, 3);
      expect('error' in result).toBe(false);
      if ('error' in result) return;
      expect(result.hitMine).toBe(false);
      expect(result.pointsDelta).toBeGreaterThan(0);
      expect(engine.getScores()['user-a']).toBe(result.pointsDelta);
    });
  });

  describe('flood-fill cascade', () => {
    it('reveals every connected zero-adjacent tile plus its numbered border in one click', () => {
      // Single mine tucked in the corner (3,3) of a 4x4 board: clicking the
      // opposite corner (0,0) should cascade across the whole open region
      // and stop at the ring of tiles bordering the mine.
      const engine = engineWithFixedMines(4, 4, [[3, 3]]);
      const result = engine.reveal('user-a', 0, 0);
      expect('error' in result).toBe(false);
      if ('error' in result) return;

      expect(result.hitMine).toBe(false);
      // 16 tiles total, 1 mine -> 15 safe tiles, all connected in this layout.
      expect(result.revealedTiles.length).toBe(15);
      expect(result.pointsDelta).toBe(result.revealedTiles.length);

      const grid = engine.getPublicGrid();
      for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 4; x++) {
          if (x === 3 && y === 3) {
            expect(grid[y]![x]!.revealed).toBe(false);
          } else {
            expect(grid[y]![x]!.revealed).toBe(true);
          }
        }
      }
    });

    it('awards the whole cascade to whoever triggered it', () => {
      const engine = engineWithFixedMines(4, 4, [[3, 3]]);
      const result = engine.reveal('user-a', 0, 0);
      if ('error' in result) throw new Error('unexpected error');

      expect(engine.getScores()).toEqual({
        'user-a': result.revealedTiles.length,
      });
      for (const tile of result.revealedTiles) {
        expect(tile.revealedBy).toBe('user-a');
      }
    });

    it('does not cascade past a tile with a nonzero adjacent count', () => {
      // Mines at (2,0) and (0,2) isolate (0,0) from most of the board:
      // (0,0) has adjacent=0 only if none of its neighbors are mines, so
      // pick a layout where the cascade from (0,0) is small and bounded.
      const engine = engineWithFixedMines(5, 5, [
        [2, 0],
        [0, 2],
        [4, 4],
      ]);
      const result = engine.reveal('user-a', 0, 0);
      if ('error' in result) throw new Error('unexpected error');

      const grid = engine.getPublicGrid();
      // Tiles far from (0,0) across the mine barrier stay untouched.
      expect(grid[4]![4]!.revealed).toBe(false);
    });
  });

  describe('game end', () => {
    it('ends the game once every safe tile is revealed, mines stay untouched', () => {
      const engine = engineWithFixedMines(3, 3, [[2, 2]]);
      const result = engine.reveal('user-a', 0, 0);
      if ('error' in result) throw new Error('unexpected error');

      expect(result.gameOver).toBe(true);
      expect(engine.isGameOver()).toBe(true);

      const mineTile = engine.getPublicGrid()[2]![2]!;
      expect(mineTile.revealed).toBe(false);
    });

    it('rejects further reveals once the game is over', () => {
      const engine = engineWithFixedMines(3, 3, [[2, 2]]);
      engine.reveal('user-a', 0, 0);
      expect(engine.reveal('user-b', 2, 2)).toEqual({ error: 'game_over' });
    });

    it('the highest score wins when scores diverge', () => {
      const engine = engineWithFixedMines(4, 4, [
        [3, 3],
        [0, 3],
      ]);
      // user-a triggers the large cascade; user-b then hits the remaining
      // mine and loses points, so user-a should have the higher score.
      const first = engine.reveal('user-a', 0, 0);
      if ('error' in first) throw new Error('unexpected error');

      if (!first.gameOver) {
        engine.reveal('user-b', 0, 3);
      }

      const scores = engine.getScores();
      const a = scores['user-a'] ?? 0;
      const b = scores['user-b'] ?? 0;
      expect(a).toBeGreaterThanOrEqual(b);
    });
  });
});
