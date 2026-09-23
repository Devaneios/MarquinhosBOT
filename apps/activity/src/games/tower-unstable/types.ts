import { z } from 'zod';

// Mirrors TowerState in marquinhos-api's TowerEngine — kept as a hand
// written twin (like pongProtocol's snapshot shape) rather than a shared
// package, since the two repos don't share a type source.
const towerLevelStateSchema = z.object({ present: z.array(z.boolean()) });

const towerLastPullSchema = z.object({
  level: z.number(),
  position: z.number(),
  instability: z.number(),
  toppled: z.boolean(),
  puller: z.string(),
});

export const towerStateSchema = z.object({
  levels: z.array(towerLevelStateSchema),
  pendingBlocks: z.number(),
  totalRemoved: z.number(),
  totalBlocksOriginal: z.number(),
  eligibleLevelCount: z.number(),
  currentPlayer: z.string(),
  turnOrder: z.array(z.string()),
  eliminated: z.array(z.string()),
  status: z.enum(['playing', 'ended']),
  winner: z.string().nullable(),
  lastPull: towerLastPullSchema.nullable(),
});

export type TowerState = z.infer<typeof towerStateSchema>;

export const initPayloadSchema = z.object({
  joined: z.boolean(),
  state: towerStateSchema.nullable(),
});

export const statePayloadSchema = z.object({ state: towerStateSchema });

export const actionRejectedPayloadSchema = z.object({ error: z.string() });
