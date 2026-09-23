import { z } from 'zod';

const snakeDirectionSchema = z.enum(['up', 'down', 'left', 'right']);
export type SnakeDirection = z.infer<typeof snakeDirectionSchema>;

const snakeSegmentSchema = z.object({ x: z.number(), y: z.number() });
export type SnakeSegment = z.infer<typeof snakeSegmentSchema>;

const snakeBodySchema = z.object({
  segments: z.array(snakeSegmentSchema),
  direction: snakeDirectionSchema,
  nextDirection: snakeDirectionSchema,
  alive: z.boolean(),
});
export type SnakeBody = z.infer<typeof snakeBodySchema>;

const snakeGameStateSchema = z.object({
  width: z.number(),
  height: z.number(),
  snakes: z.record(z.string(), snakeBodySchema),
  food: z.array(snakeSegmentSchema),
  scores: z.record(z.string(), z.number()),
  winner: z.string().nullable(),
});
export type SnakeGameState = z.infer<typeof snakeGameStateSchema>;

const snakePublicConfigSchema = z.object({
  width: z.number(),
  height: z.number(),
  initialSnakeLength: z.number(),
  winningScore: z.number(),
});
export type SnakePublicConfig = z.infer<typeof snakePublicConfigSchema>;

export const initPayloadSchema = z.object({
  playerId: z.string().nullable(),
  config: snakePublicConfigSchema.optional(),
});

export const statePayloadSchema = z.object({ state: snakeGameStateSchema });

export const opponentDisconnectedPayloadSchema = z.object({
  playerId: z.string(),
  timeoutMs: z.number(),
});

export interface SnakeSessionState {
  playerId: string | null;
  config: SnakePublicConfig | null;
  state: SnakeGameState | null;
  connected: boolean;
}
