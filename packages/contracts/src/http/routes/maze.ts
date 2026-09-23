import { z } from 'zod';
import { defineContract, envelope } from '../contract';

export const MAZE_MODES = ['open', 'foggy'] as const;
export const MAZE_SIZES = [15, 31, 51, 99];
export const MAZE_DIRECTIONS = ['up', 'down', 'left', 'right'] as const;

export const mazeViewportStateSchema = z.object({
  sessionId: z.string(),
  playerPosition: z.object({ x: z.number(), y: z.number() }),
  viewport: z.array(z.array(z.number())),
  moves: z.number(),
  isCompleted: z.boolean(),
  isAbandoned: z.boolean().optional(),
});
export type MazeViewportState = z.output<typeof mazeViewportStateSchema>;

const sessionParams = z.object({ sessionId: z.string().min(1) });

export const startMaze = defineContract({
  method: 'POST',
  path: '/api/games/maze/start',
  body: z.object({
    userId: z.string().min(1),
    guildId: z.string().min(1),
    mode: z.enum(MAZE_MODES),
    size: z.coerce.number().refine((size) => MAZE_SIZES.includes(size)),
  }),
  response: envelope(mazeViewportStateSchema),
});

export const moveMaze = defineContract({
  method: 'POST',
  path: '/api/games/maze/:sessionId/move',
  params: sessionParams,
  body: z.object({
    userId: z.string().min(1),
    direction: z.enum(MAZE_DIRECTIONS),
  }),
  response: envelope(mazeViewportStateSchema),
});

export const getMaze = defineContract({
  method: 'GET',
  path: '/api/games/maze/:sessionId',
  params: sessionParams,
  response: envelope(mazeViewportStateSchema),
});

export const abandonMaze = defineContract({
  method: 'DELETE',
  path: '/api/games/maze/:sessionId',
  params: sessionParams,
  body: z.object({ userId: z.string().min(1) }),
  response: z.object({ message: z.string() }),
});
