import { z } from 'zod';
import { chainEndSchema, dominoTileSchema } from './payloadSchemas';

export type Tile = z.infer<typeof dominoTileSchema>;

export type ChainEnd = z.infer<typeof chainEndSchema>;

// Mirrors DominoesClientState in marquinhos-api's DominoesSession.ts — the
// masked, per-recipient view a 'state' message carries. `hand` is only
// populated for the player it was addressed to; spectators and other
// players' hands are represented purely by `handCounts`.
export const dominoesClientStateSchema = z.object({
  players: z.array(z.string()),
  handCounts: z.record(z.string(), z.number()),
  hand: z.array(dominoTileSchema).nullable(),
  boneyard: z.number(),
  chain: z.array(dominoTileSchema),
  leftEnd: z.number().nullable(),
  rightEnd: z.number().nullable(),
  currentPlayer: z.string().nullable(),
  winner: z.string().nullable(),
  winners: z.array(z.string()).nullable(),
  blocked: z.boolean(),
  pipTotals: z.record(z.string(), z.number()).nullable(),
});

export type DominoesClientState = z.infer<typeof dominoesClientStateSchema>;

export const moveRejectedPayloadSchema = z.object({ reason: z.string() });

export const opponentDisconnectedPayloadSchema = z.object({
  userId: z.string(),
  timeoutMs: z.number(),
});
