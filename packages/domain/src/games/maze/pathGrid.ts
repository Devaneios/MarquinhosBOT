import { shuffle } from '@marquinhos/domain/shared/random/shuffle';

/**
 * Generates a perfect maze using iterative depth-first search (recursive backtracker).
 * Grid size must be odd. Cells at odd (row, col) are path nodes; even cells are walls.
 * Returns a 2D boolean array: true = walkable, false = wall.
 */
export function generatePathGrid(size: number): boolean[][] {
  const grid: boolean[][] = Array.from({ length: size }, () =>
    new Array(size).fill(false),
  );

  // Carve starting cell
  grid[1][1] = true;

  const stack: [number, number][] = [[1, 1]];
  const directions: [number, number][] = [
    [-2, 0],
    [2, 0],
    [0, -2],
    [0, 2],
  ];

  while (stack.length > 0) {
    const [r, c] = stack[stack.length - 1];

    let moved = false;

    for (const [dr, dc] of shuffle(directions)) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr > 0 && nr < size - 1 && nc > 0 && nc < size - 1 && !grid[nr][nc]) {
        // Carve wall between current and neighbor
        grid[r + dr / 2][c + dc / 2] = true;
        grid[nr][nc] = true;
        stack.push([nr, nc]);
        moved = true;
        break;
      }
    }

    if (!moved) {
      stack.pop();
    }
  }

  // Ensure goal cell is always reachable
  grid[size - 2][size - 2] = true;

  return grid;
}
