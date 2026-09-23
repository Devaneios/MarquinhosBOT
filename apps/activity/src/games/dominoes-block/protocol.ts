import { z } from 'zod';

const tileSchema = z.object({ a: z.number(), b: z.number() });

export type Tile = z.infer<typeof tileSchema>;

export type ChainEnd = 'left' | 'right';

// Mirrors DominoesClientState in marquinhos-api's DominoesSession.ts — the
// masked, per-recipient view a 'state' message carries. `hand` is only
// populated for the player it was addressed to; spectators and other
// players' hands are represented purely by `handCounts`.
export const dominoesClientStateSchema = z.object({
  players: z.array(z.string()),
  handCounts: z.record(z.string(), z.number()),
  hand: z.array(tileSchema).nullable(),
  boneyard: z.number(),
  chain: z.array(tileSchema),
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

export function tileKey(tile: Tile): string {
  return `${tile.a}-${tile.b}`;
}

export function tileMatches(candidate: Tile, tile: Tile): boolean {
  return (
    (candidate.a === tile.a && candidate.b === tile.b) ||
    (candidate.a === tile.b && candidate.b === tile.a)
  );
}

// Which end(s) of the open chain a hand tile could legally land on, purely
// from the client's own copy of the state — used to enable/disable tiles and
// to skip the end-picker when only one end accepts the tile. The server is
// the actual authority; this is only ever a UI convenience.
export function legalEndsFor(
  tile: Tile,
  leftEnd: number | null,
  rightEnd: number | null,
): ChainEnd[] {
  if (leftEnd === null || rightEnd === null) return [];
  const ends: ChainEnd[] = [];
  if (tile.a === leftEnd || tile.b === leftEnd) ends.push('left');
  if (tile.a === rightEnd || tile.b === rightEnd) ends.push('right');
  return ends;
}
