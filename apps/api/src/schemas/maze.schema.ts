import { z } from 'zod';

export const MAZE_MODES = ['open', 'foggy'] as const;
export const MAZE_SIZES = [15, 31, 51, 99];
export const MAZE_DIRECTIONS = ['up', 'down', 'left', 'right'] as const;

export const startMazeBodySchema = z.object({
  userId: z.string().min(1),
  guildId: z.string().min(1),
  mode: z.enum(MAZE_MODES),
  size: z.coerce.number().refine((size) => MAZE_SIZES.includes(size)),
});

export const moveMazeBodySchema = z.object({
  userId: z.string().min(1),
  direction: z.enum(MAZE_DIRECTIONS),
});

export const abandonMazeBodySchema = z.object({
  userId: z.string().min(1),
});

export const mazeSessionParamsSchema = z.object({
  sessionId: z.string().min(1),
});
