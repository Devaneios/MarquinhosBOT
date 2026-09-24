import { z } from 'zod';
import { leaveMessageSchema } from '../protocol';

export const SNAKE_DIRECTIONS = ['up', 'down', 'left', 'right'] as const;
export const snakeDirectionSchema = z.enum(SNAKE_DIRECTIONS);
export type SnakeDirection = z.output<typeof snakeDirectionSchema>;

export const snakeSegmentSchema = z.object({ x: z.number(), y: z.number() });
export type SnakeSegment = z.output<typeof snakeSegmentSchema>;

export const snakeBodySchema = z.object({
  segments: z.array(snakeSegmentSchema),
  direction: snakeDirectionSchema,
  nextDirection: snakeDirectionSchema,
  alive: z.boolean(),
});
export type SnakeBody = z.output<typeof snakeBodySchema>;

export const snakeGameStateSchema = z.object({
  width: z.number(),
  height: z.number(),
  snakes: z.record(z.string(), snakeBodySchema),
  food: z.array(snakeSegmentSchema),
  scores: z.record(z.string(), z.number()),
  winner: z.string().nullable(),
});
export type SnakeGameState = z.output<typeof snakeGameStateSchema>;

export const snakePublicConfigSchema = z.object({
  width: z.number(),
  height: z.number(),
  initialSnakeLength: z.number(),
  winningScore: z.number(),
});
export type SnakePublicConfig = z.output<typeof snakePublicConfigSchema>;

export const inputPayloadSchema = z.object({ direction: snakeDirectionSchema });

export const clientMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('input'), payload: inputPayloadSchema }),
  leaveMessageSchema,
]);
export type SnakeClientMessage = z.output<typeof clientMessageSchema>;

export const serverMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('init'),
    payload: z.object({
      playerId: z.string().nullable(),
      config: snakePublicConfigSchema,
    }),
  }),
  z.object({
    type: z.literal('state'),
    payload: z.object({ seq: z.number(), state: snakeGameStateSchema }),
  }),
  z.object({
    type: z.literal('input_error'),
    payload: z.object({ message: z.string() }),
  }),
  z.object({
    type: z.literal('opponent_disconnected'),
    payload: z.object({ playerId: z.string(), timeoutMs: z.number() }),
  }),
  z.object({
    type: z.literal('opponent_reconnected'),
    payload: z.object({ playerId: z.string() }),
  }),
]);
export type SnakeServerMessage = z.output<typeof serverMessageSchema>;
