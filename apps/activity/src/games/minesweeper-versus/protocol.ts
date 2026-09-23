import { z } from 'zod';

const publicCellSchema = z.object({
  revealed: z.boolean(),
  mine: z.boolean().optional(),
  adjacent: z.number().optional(),
  revealedBy: z.string().nullable().optional(),
});

export type PublicCell = z.infer<typeof publicCellSchema>;

const scoresSchema = z.record(z.string(), z.number());

export const boardSnapshotSchema = z.object({
  width: z.number(),
  height: z.number(),
  grid: z.array(z.array(publicCellSchema)),
  scores: scoresSchema,
  gameOver: z.boolean(),
});

export type BoardSnapshot = z.infer<typeof boardSnapshotSchema>;

const revealedTileSchema = z.object({
  x: z.number(),
  y: z.number(),
  mine: z.boolean(),
  adjacent: z.number(),
  revealedBy: z.string(),
});

export type RevealedTile = z.infer<typeof revealedTileSchema>;

export const revealPayloadSchema = z.object({
  userId: z.string(),
  revealedTiles: z.array(revealedTileSchema),
  pointsDelta: z.number(),
  hitMine: z.boolean(),
  gameOver: z.boolean(),
  scores: scoresSchema,
});

export type RevealPayload = z.infer<typeof revealPayloadSchema>;

export const gameOverPayloadSchema = z.object({ scores: scoresSchema });

export const revealErrorPayloadSchema = z.object({ message: z.string() });
