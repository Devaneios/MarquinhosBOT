/**
 * Randomized Kruskal's maze generation algorithm.
 * Reference: https://weblog.jamisbuck.org/2011/1/3/maze-generation-kruskal-s-algorithm
 *
 * Grid convention:
 *   0 = open path
 *   1 = wall
 *
 * Navigable cells sit at odd (row, col) indices.
 * Passage cells connect adjacent navigable cells at the midpoint (even index).
 * All boundary cells are walls except the opened entry and exit.
 *
 * Entry: maze[0][1]               (hole in top wall, col 1)
 * Exit:  maze[height-1][width-2]  (hole in bottom wall, second-to-last col)
 */

function at<T>(arr: T[], i: number): T {
  const v = arr[i];
  if (v === undefined) throw new Error('Index out of bounds');
  return v;
}

// --- Union-Find (disjoint set) ---

function makeUnionFind(size: number): { parent: number[]; rank: number[] } {
  return {
    parent: Array.from({ length: size }, (_, i) => i),
    rank: new Array(size).fill(0),
  };
}

function find(uf: { parent: number[] }, x: number): number {
  while (at(uf.parent, x) !== x) {
    uf.parent[x] = at(uf.parent, at(uf.parent, x));
    x = at(uf.parent, x);
  }
  return x;
}

function union(
  uf: { parent: number[]; rank: number[] },
  a: number,
  b: number,
): boolean {
  const ra = find(uf, a);
  const rb = find(uf, b);
  if (ra === rb) return false; // already connected
  if (at(uf.rank, ra) < at(uf.rank, rb)) {
    uf.parent[ra] = rb;
  } else if (at(uf.rank, ra) > at(uf.rank, rb)) {
    uf.parent[rb] = ra;
  } else {
    uf.parent[rb] = ra;
    uf.rank[ra] = at(uf.rank, ra) + 1;
  }
  return true;
}

// --- Fisher-Yates shuffle ---

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = at(arr, i);
    arr[i] = at(arr, j);
    arr[j] = tmp;
  }
  return arr;
}

// --- Maze generation ---

export function generateMaze(width: number, height: number): number[][] {
  // Ensure odd dimensions so navigable cells land on odd indices
  if (width % 2 === 0) width++;
  if (height % 2 === 0) height++;

  // Number of navigable cells along each axis
  const cols = Math.floor(width / 2); // navigable columns: 1, 3, 5, ...
  const rows = Math.floor(height / 2); // navigable rows:    1, 3, 5, ...

  // Fill grid with walls
  const maze: number[][] = Array.from({ length: height }, () =>
    Array(width).fill(1),
  );

  // Map navigable cell (r, c) → unique id for Union-Find
  // r and c are in navigable-cell space (0-based), NOT grid space
  const cellId = (r: number, c: number) => r * cols + c;
  const uf = makeUnionFind(rows * cols);

  // Collect all internal edges (horizontal and vertical)
  // An edge connects two adjacent navigable cells.
  // Stored as [r1, c1, r2, c2] in navigable-cell coordinates.
  const edges: [number, number, number, number][] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // Horizontal edge: (r,c) — (r, c+1)
      if (c + 1 < cols) edges.push([r, c, r, c + 1]);
      // Vertical edge:   (r,c) — (r+1, c)
      if (r + 1 < rows) edges.push([r, c, r + 1, c]);
    }
  }

  shuffle(edges);

  for (const [r1, c1, r2, c2] of edges) {
    if (union(uf, cellId(r1, c1), cellId(r2, c2))) {
      // Convert navigable-cell coords to grid coords (odd indices)
      const gr1 = r1 * 2 + 1;
      const gc1 = c1 * 2 + 1;
      const gr2 = r2 * 2 + 1;
      const gc2 = c2 * 2 + 1;

      // Carve both cells and the passage between them
      at(maze, gr1)[gc1] = 0;
      at(maze, gr2)[gc2] = 0;
      at(maze, (gr1 + gr2) / 2)[(gc1 + gc2) / 2] = 0;
    }
  }

  // Entry: top wall above col 1 (navigable cell 0,0 is at grid row 1, col 1)
  at(maze, 0)[1] = 0;

  // Exit: bottom wall below second-to-last navigable col of last navigable row
  at(maze, height - 1)[width - 2] = 0;
  at(maze, height - 2)[width - 2] = 0; // ensure connectivity to last row

  return maze;
}
