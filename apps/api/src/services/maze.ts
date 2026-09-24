import type { mazeViewportStateSchema } from '@marquinhos/contracts/http/routes/maze';
import { db, type DbExecutor } from '@marquinhos/database/client';
import { mazeSessions } from '@marquinhos/database/schema';
import { generateWallGrid } from '@marquinhos/domain/games/maze/wallGrid';
import crypto from 'crypto';
import { and, eq } from 'drizzle-orm';
import type { z } from 'zod';

/**
 * Viewport cell types returned to the bot.
 *   0 = wall   → 🧱
 *   1 = path   → ⬜
 *   2 = player → 👤
 *   3 = exit   → 🏆
 *   4 = border → 🟩  (out-of-bounds cells / explicit frame)
 *   5 = hidden → ⬛  (foggy mode: not visible to player)
 */

export type MazeViewportState = z.input<typeof mazeViewportStateSchema>;

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
  async createMazeSession(
    userId: string,
    guildId: string,
    mode: 'open' | 'foggy',
    size: number,
  ): Promise<MazeViewportState> {
    const maze = generateWallGrid(size, size);
    const mazeHeight = maze.length;
    const width = mazeWidth(maze);

    const exitX = width - 2;
    const exitY = mazeHeight - 1;

    const sessionId = crypto.randomUUID();
    const startX = 1;
    const startY = 0;

    await db.transaction(async (tx) => {
      // Abandon any existing active session for this user in this guild
      await tx
        .update(mazeSessions)
        .set({ status: 'abandoned' })
        .where(
          and(
            eq(mazeSessions.user_id, userId),
            eq(mazeSessions.guild_id, guildId),
            eq(mazeSessions.status, 'active'),
          ),
        );
      await tx.insert(mazeSessions).values({
        id: sessionId,
        user_id: userId,
        guild_id: guildId,
        game_mode: mode,
        maze_width: width,
        maze_height: mazeHeight,
        maze_grid: JSON.stringify(maze),
        player_x: startX,
        player_y: startY,
        started_at: Math.floor(Date.now() / 1000),
      });
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
  ): Promise<MazeViewportState | null> {
    // Locked so two quick moves can't both start from the same position.
    return db.transaction((tx) =>
      this.applyMove(tx, sessionId, userId, direction),
    );
  }

  private async applyMove(
    tx: DbExecutor,
    sessionId: string,
    userId: string,
    direction: string,
  ): Promise<MazeViewportState | null> {
    const [session] = await tx
      .select()
      .from(mazeSessions)
      .where(eq(mazeSessions.id, sessionId))
      .for('update');

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
      await tx
        .update(mazeSessions)
        .set({
          player_x: newX,
          player_y: newY,
          moves_count: newMoves,
          status: 'abandoned',
        })
        .where(eq(mazeSessions.id, sessionId));

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

    await tx
      .update(mazeSessions)
      .set({
        player_x: newX,
        player_y: newY,
        moves_count: newMoves,
        status: isCompleted ? 'completed' : 'active',
        completed_at: isCompleted ? Math.floor(Date.now() / 1000) : null,
      })
      .where(eq(mazeSessions.id, sessionId));

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

  async getMazeSession(sessionId: string): Promise<MazeViewportState | null> {
    const [session] = await db
      .select()
      .from(mazeSessions)
      .where(eq(mazeSessions.id, sessionId));

    if (!session) return null;

    const maze: number[][] = JSON.parse(session.maze_grid);
    const exitX = session.maze_width - 2;
    const exitY = session.maze_height - 1;

    return this._buildState(session, maze, exitX, exitY);
  }

  async abandonMazeSession(sessionId: string, userId: string): Promise<void> {
    await db
      .update(mazeSessions)
      .set({ status: 'abandoned' })
      .where(
        and(eq(mazeSessions.id, sessionId), eq(mazeSessions.user_id, userId)),
      );
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
