import { z } from 'zod';

export const publicCellSchema = z.object({
  revealed: z.boolean(),
  mine: z.boolean().optional(),
  adjacent: z.number().optional(),
  revealedBy: z.string().nullable().optional(),
});

export type PublicCell = z.output<typeof publicCellSchema>;

const scoresSchema = z.record(z.string(), z.number());

export const boardSnapshotSchema = z.object({
  width: z.number(),
  height: z.number(),
  grid: z.array(z.array(publicCellSchema)),
  scores: scoresSchema,
  gameOver: z.boolean(),
});

export type BoardSnapshot = z.output<typeof boardSnapshotSchema>;

export const revealedTileSchema = z.object({
  x: z.number(),
  y: z.number(),
  mine: z.boolean(),
  adjacent: z.number(),
  revealedBy: z.string(),
});

export type RevealedTile = z.output<typeof revealedTileSchema>;

export const revealPayloadSchema = z.object({
  userId: z.string(),
  revealedTiles: z.array(revealedTileSchema),
  pointsDelta: z.number(),
  hitMine: z.boolean(),
  gameOver: z.boolean(),
  scores: scoresSchema,
});

export type RevealPayload = z.output<typeof revealPayloadSchema>;

export const revealRequestSchema = z.object({
  x: z.number().int(),
  y: z.number().int(),
});

export const clientMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('reveal'), payload: revealRequestSchema }),
]);
export type MinesweeperClientMessage = z.output<typeof clientMessageSchema>;

export const serverMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('init'), payload: boardSnapshotSchema }),
  z.object({ type: z.literal('reveal'), payload: revealPayloadSchema }),
  z.object({
    type: z.literal('game_over'),
    payload: z.object({ scores: scoresSchema }),
  }),
  z.object({
    type: z.literal('reveal_error'),
    payload: z.object({ message: z.string() }),
  }),
]);
export type MinesweeperServerMessage = z.output<typeof serverMessageSchema>;
