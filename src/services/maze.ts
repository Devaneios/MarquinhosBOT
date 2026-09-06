import crypto from 'crypto';
import { db } from 'database/sqlite';
import { generateMaze } from 'utils/mazeGenerator';

/**
 * Viewport cell types returned to the bot.
 *   0 = wall   → 🧱
 *   1 = path   → ⬜
 *   2 = player → 👤
 *   3 = exit   → 🏆
 *   4 = border → 🟩  (out-of-bounds cells / explicit frame)
 *   5 = hidden → ⬛  (foggy mode: not visible to player)
 */

export interface MazeViewportState {
  sessionId: string;
  playerPosition: { x: number; y: number };
  viewport: number[][];
  moves: number;
  isCompleted: boolean;
  isAbandoned?: boolean;
}

interface MazeSessionRow {
  id: string;
  user_id: string;
  guild_id: string;
  game_mode: 'open' | 'foggy';
  maze_width: number;
  maze_height: number;
  maze_grid: string;
  player_x: number;
  player_y: number;
  moves_count: number;
  status: 'active' | 'completed' | 'abandoned';
  started_at: number;
  completed_at: number | null;
}

const VIEWPORT_SIZE = 8;
// Player sits at viewport index 3 (0-indexed), so view starts at player - 3
const PLAYER_VIEWPORT_OFFSET = 3;

function mazeWidth(maze: number[][]): number {
  const firstRow = maze[0];
  if (!firstRow) throw new Error('Invalid maze: empty grid');
  return firstRow.length;
}

function mazeCell(maze: number[][], row: number, col: number): number {
  const cell = maze[row]?.[col];
  if (cell === undefined) throw new Error('Invalid maze coordinates');
  return cell;
}

function computeFoggyVisibility(
  maze: number[][],
  px: number,
  py: number,
): Set<string> {
  const visible = new Set<string>();
  visible.add(`${py},${px}`);

  const directions: [number, number][] = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];
  for (const [dr, dc] of directions) {
    let r = py + dr;
    let c = px + dc;
    while (
      r >= 0 &&
      r < maze.length &&
      c >= 0 &&
      c < mazeWidth(maze) &&
      mazeCell(maze, r, c) === 0
    ) {
      visible.add(`${r},${c}`);
      r += dr;
      c += dc;
    }
  }
  return visible;
}

function computeViewport(
  maze: number[][],
  px: number,
  py: number,
  mode: 'open' | 'foggy',
  exitX: number,
  exitY: number,
): number[][] {
  const mazeHeight = maze.length;
  const width = mazeWidth(maze);
  const viewTopRow = py - PLAYER_VIEWPORT_OFFSET;
  const viewTopCol = px - PLAYER_VIEWPORT_OFFSET;

  const visible =
    mode === 'foggy' ? computeFoggyVisibility(maze, px, py) : null;

  const viewport: number[][] = [];
  for (let vr = 0; vr < VIEWPORT_SIZE; vr++) {
    const row: number[] = [];
    for (let vc = 0; vc < VIEWPORT_SIZE; vc++) {
      const mr = viewTopRow + vr;
      const mc = viewTopCol + vc;

      if (mr < 0 || mr >= mazeHeight || mc < 0 || mc >= width) {
        row.push(4); // BORDER (out of bounds)
        continue;
      }

      if (mc === px && mr === py) {
        row.push(2); // PLAYER
        continue;
      }

      if (mc === exitX && mr === exitY) {
        if (visible === null || visible.has(`${mr},${mc}`)) {
          row.push(3); // EXIT
        } else {
          row.push(5); // EXIT hidden in fog
        }
        continue;
      }

      if (visible !== null && !visible.has(`${mr},${mc}`)) {
        row.push(5); // HIDDEN
        continue;
      }

      // maze: 0 = path → type 1 (PATH), 1 = wall → type 0 (WALL)
      row.push(mazeCell(maze, mr, mc) === 0 ? 1 : 0);
    }
    viewport.push(row);
  }
  return viewport;
}

export class MazeService {
  createMazeSession(
    userId: string,
    guildId: string,
    mode: 'open' | 'foggy',
    size: number,
  ): MazeViewportState {
    // Abandon any existing active session for this user in this guild
    db.query(
      "UPDATE maze_sessions SET status = 'abandoned' WHERE user_id = $userId AND guild_id = $guildId AND status = 'active'",
    ).run({ $userId: userId, $guildId: guildId });

    const maze = generateMaze(size, size);
    const mazeHeight = maze.length;
    const width = mazeWidth(maze);

    const exitX = width - 2;
    const exitY = mazeHeight - 1;

    const sessionId = crypto.randomUUID();
    const startX = 1;
    const startY = 0;

    db.query(
      `
      INSERT INTO maze_sessions
        (id, user_id, guild_id, game_mode, maze_width, maze_height, maze_grid, player_x, player_y, started_at)
      VALUES
        ($id, $userId, $guildId, $mode, $width, $height, $grid, $px, $py, $startedAt)
    `,
    ).run({
      $id: sessionId,
      $userId: userId,
      $guildId: guildId,
      $mode: mode,
      $width: width,
      $height: mazeHeight,
      $grid: JSON.stringify(maze),
      $px: startX,
      $py: startY,
      $startedAt: Math.floor(Date.now() / 1000),
    });

    return {
      sessionId,
      playerPosition: { x: startX, y: startY },
      viewport: computeViewport(maze, startX, startY, mode, exitX, exitY),
      moves: 0,
      isCompleted: false,
    };
  }

  processMazeMove(
    sessionId: string,
    userId: string,
    direction: string,
  ): MazeViewportState | null {
    const session = db
      .query<MazeSessionRow, { $id: string }>(
        'SELECT * FROM maze_sessions WHERE id = $id',
      )
      .get({ $id: sessionId });

    if (!session || session.user_id !== userId || session.status !== 'active') {
      return null;
    }

    const maze: number[][] = JSON.parse(session.maze_grid);
    const exitX = session.maze_width - 2;
    const exitY = session.maze_height - 1;

    let newX = session.player_x;
    let newY = session.player_y;

    switch (direction) {
      case 'up':
        newY--;
        break;
      case 'down':
        newY++;
        break;
      case 'left':
        newX--;
        break;
      case 'right':
        newX++;
        break;
      default:
        return this._buildState(session, maze, exitX, exitY);
    }

    // Validate move: must be within bounds and not a wall
    if (
      newX < 0 ||
      newX >= session.maze_width ||
      newY < 0 ||
      newY >= session.maze_height ||
      mazeCell(maze, newY, newX) === 1
    ) {
      return this._buildState(session, maze, exitX, exitY);
    }

    const isCompleted = newX === exitX && newY === exitY;
    const newMoves = session.moves_count + 1;

    const maxMoves = session.maze_width * session.maze_height * 2;
    if (!isCompleted && newMoves >= maxMoves) {
      db.query(
        "UPDATE maze_sessions SET player_x = $px, player_y = $py, moves_count = $moves, status = 'abandoned' WHERE id = $id",
      ).run({ $px: newX, $py: newY, $moves: newMoves, $id: sessionId });

      return {
        sessionId,
        playerPosition: { x: newX, y: newY },
        viewport: computeViewport(
          maze,
          newX,
          newY,
          session.game_mode,
          exitX,
          exitY,
        ),
        moves: newMoves,
        isCompleted: false,
        isAbandoned: true,
      };
    }

    db.query(
      `
      UPDATE maze_sessions
      SET player_x = $px, player_y = $py, moves_count = $moves,
          status = $status, completed_at = $completedAt
      WHERE id = $id
    `,
    ).run({
      $px: newX,
      $py: newY,
      $moves: newMoves,
      $status: isCompleted ? 'completed' : 'active',
      $completedAt: isCompleted ? Math.floor(Date.now() / 1000) : null,
      $id: sessionId,
    });

    return {
      sessionId,
      playerPosition: { x: newX, y: newY },
      viewport: computeViewport(
        maze,
        newX,
        newY,
        session.game_mode,
        exitX,
        exitY,
      ),
      moves: newMoves,
      isCompleted,
    };
  }

  getMazeSession(sessionId: string): MazeViewportState | null {
    const session = db
      .query<MazeSessionRow, { $id: string }>(
        'SELECT * FROM maze_sessions WHERE id = $id',
      )
      .get({ $id: sessionId });

    if (!session) return null;

    const maze: number[][] = JSON.parse(session.maze_grid);
    const exitX = session.maze_width - 2;
    const exitY = session.maze_height - 1;

    return this._buildState(session, maze, exitX, exitY);
  }

  abandonMazeSession(sessionId: string, userId: string): void {
    db.query(
      "UPDATE maze_sessions SET status = 'abandoned' WHERE id = $id AND user_id = $userId",
    ).run({ $id: sessionId, $userId: userId });
  }

  private _buildState(
    session: MazeSessionRow,
    maze: number[][],
    exitX: number,
    exitY: number,
  ): MazeViewportState {
    return {
      sessionId: session.id,
      playerPosition: { x: session.player_x, y: session.player_y },
      viewport: computeViewport(
        maze,
        session.player_x,
        session.player_y,
        session.game_mode,
        exitX,
        exitY,
      ),
      moves: session.moves_count,
      isCompleted: session.status === 'completed',
      isAbandoned: session.status === 'abandoned',
    };
  }
}
