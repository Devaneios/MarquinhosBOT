import { describe, expect, it } from 'bun:test';
import { generateMaze } from './generator';
import { generateMaze as generateBotMaze } from './botGenerator';

function reachesExit(grid: boolean[][]): boolean {
  const last = grid.length - 2;
  const seen = new Set<string>();
  const queue: [number, number][] = [[1, 1]];
  while (queue.length > 0) {
    const [row, col] = queue.shift()!;
    if (row === last && col === last) return true;
    const key = `${row},${col}`;
    if (seen.has(key) || !grid[row]?.[col]) continue;
    seen.add(key);
    queue.push([row + 1, col], [row - 1, col], [row, col + 1], [row, col - 1]);
  }
  return false;
}

describe('maze generators', () => {
  it('creates a reachable API maze with entry and exit in its boundary', () => {
    const maze = generateMaze(15, 15);
    expect(maze[0][1]).toBe(0);
    expect(maze[14][13]).toBe(0);
    expect(reachesExit(maze.map((row) => row.map((cell) => cell === 0)))).toBe(true);
  });

  it('creates a reachable bot maze', () => {
    const maze = generateBotMaze(15);
    expect(maze[1][1]).toBe(true);
    expect(reachesExit(maze)).toBe(true);
  });
});
