import { z } from 'zod';
import {
  actionRejectedMessageSchema,
  leaveMessageSchema,
  restartMessageSchema,
  restartStatusMessageSchema,
} from '../protocol';

export const towerLevelStateSchema = z.object({
  present: z.array(z.boolean()),
});
export type TowerLevelState = z.output<typeof towerLevelStateSchema>;

export const towerLastPullSchema = z.object({
  level: z.number(),
  position: z.number(),
  instability: z.number(),
  toppled: z.boolean(),
  puller: z.string(),
});
export type TowerLastPull = z.output<typeof towerLastPullSchema>;

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
export type TowerState = z.output<typeof towerStateSchema>;

export const pullPayloadSchema = z.object({
  level: z.number().int(),
  position: z.number().int(),
});

export const clientMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('pull'), payload: pullPayloadSchema }),
  restartMessageSchema,
  leaveMessageSchema,
]);
export type TowerClientMessage = z.output<typeof clientMessageSchema>;

export const serverMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('init'),
    payload: z.object({
      joined: z.boolean(),
      state: towerStateSchema.nullable(),
    }),
  }),
  z.object({
    type: z.literal('game_ready'),
    payload: z.object({ state: towerStateSchema }),
  }),
  z.object({
    type: z.literal('state_update'),
    payload: z.object({ state: towerStateSchema }),
  }),
  actionRejectedMessageSchema,
  restartStatusMessageSchema,
  z.object({
    type: z.literal('opponent_disconnected'),
    payload: z.object({ userId: z.string(), timeoutMs: z.number() }),
  }),
  z.object({
    type: z.literal('opponent_reconnected'),
    payload: z.object({ userId: z.string() }),
  }),
]);
export type TowerServerMessage = z.output<typeof serverMessageSchema>;
