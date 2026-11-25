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

const mazeTags = ['Maze'] as const;
const botSecurity = ['botBearer'] as const;
const userId = '123456789012345678';
const guildId = '234567890123456789';
const sessionId = '21dc2842-4cac-4f65-8684-469322596e16';
const startViewportExample = {
  sessionId,
  playerPosition: { x: 1, y: 0 },
  viewport: [
    [4, 4, 4, 4, 4, 4, 4, 4],
    [4, 4, 4, 4, 4, 4, 4, 4],
    [4, 4, 4, 4, 4, 4, 4, 4],
    [4, 4, 0, 2, 0, 0, 0, 0],
    [4, 4, 0, 1, 1, 1, 0, 1],
    [4, 4, 0, 0, 0, 1, 0, 1],
    [4, 4, 0, 1, 1, 1, 1, 1],
    [4, 4, 0, 1, 0, 0, 0, 0],
  ],
  moves: 0,
  isCompleted: false,
};

const mazeErrors = {
  401: {
    description: 'The bot credential was absent or invalid.',
    example: { message: 'Token not authorized' },
  },
  500: {
    description:
      'The API could not access the Maze session or the bot key is not configured.',
    example: { message: 'Unknown Error' },
  },
};
const requestTooLarge = {
  description: 'The JSON body exceeded the API size limit.',
  example: { message: 'Request body too large' },
};

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
  docs: {
    description:
      'Generate a Maze session for the specified player and guild. Creating a session abandons that player’s previous active session in the same guild. Available grid sizes are 15, 31, 51, and 99.',
    tags: mazeTags,
    security: botSecurity,
    examples: { body: { userId, guildId, mode: 'open', size: 15 } },
    success: {
      200: {
        description: 'New session at the entrance with its initial viewport.',
        example: { data: startViewportExample },
      },
    },
    errors: {
      ...mazeErrors,
      400: {
        description: 'The player, guild, mode, or supported size was invalid.',
        example: { message: 'size must be one of: 15, 31, 51, 99' },
      },
      413: requestTooLarge,
    },
  },
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
  docs: {
    description:
      'Apply one directional move to an active session owned by the supplied player. Concurrent moves are serialized. A wall or boundary leaves the player and move count in place.',
    tags: mazeTags,
    security: botSecurity,
    examples: { params: { sessionId }, body: { userId, direction: 'up' } },
    success: {
      200: {
        description:
          'Current viewport. In this example the north boundary blocks the move.',
        example: { data: startViewportExample },
      },
    },
    errors: {
      ...mazeErrors,
      400: {
        description: 'The session ID, user ID, or direction failed validation.',
        example: { message: 'direction must be one of: up, down, left, right' },
      },
      404: {
        description:
          'The session is absent, inactive, or owned by another user.',
        example: { message: 'Maze session not found or not active' },
      },
      413: requestTooLarge,
    },
  },
});

export const getMaze = defineContract({
  method: 'GET',
  path: '/api/games/maze/:sessionId',
  params: sessionParams,
  response: envelope(mazeViewportStateSchema),
  docs: {
    description:
      'Read the stored position, viewport, move count, and completion or abandonment state for a session ID.',
    tags: mazeTags,
    security: botSecurity,
    examples: { params: { sessionId } },
    success: {
      200: {
        description:
          'Stored Maze session snapshot, including terminal sessions.',
        example: { data: { ...startViewportExample, isAbandoned: false } },
      },
    },
    errors: {
      ...mazeErrors,
      400: {
        description: 'The session identifier did not pass validation.',
        example: { message: 'sessionId is required' },
      },
      404: {
        description: 'No session exists for this ID.',
        example: { message: 'Maze session not found' },
      },
    },
  },
});

export const abandonMaze = defineContract({
  method: 'DELETE',
  path: '/api/games/maze/:sessionId',
  params: sessionParams,
  body: z.object({ userId: z.string().min(1) }),
  response: z.object({ message: z.string() }),
  docs: {
    description:
      'Mark the matching session abandoned for its supplied owner. Repeating the request is safe and the same acknowledgement is returned when no row matches.',
    tags: mazeTags,
    security: botSecurity,
    examples: { params: { sessionId }, body: { userId } },
    success: {
      200: {
        description:
          'Abandon request processed for this session and user pair.',
        example: { message: 'Maze session abandoned' },
      },
    },
    errors: {
      ...mazeErrors,
      400: {
        description: 'The session or user ID was missing or invalid.',
        example: { message: 'userId is required' },
      },
      413: requestTooLarge,
    },
  },
});
