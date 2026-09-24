import { z } from 'zod';
import {
  bestOfSchema,
  PONG_ARENAS,
  pongRulesetIdSchema,
  pongSideSchema,
} from '../pong/types';
import {
  leaveMessageSchema,
  restartMessageSchema,
  restartStatusMessageSchema,
} from '../protocol';

export const pongAssignmentSchema = z.object({
  slot: z.number(),
  side: pongSideSchema,
  team: z.number(),
});
export type PongAssignment = z.output<typeof pongAssignmentSchema>;

export const pongLobbyStateSchema = z.object({
  hostUserId: z.string().nullable(),
  started: z.boolean(),
  config: z.object({
    ruleset: pongRulesetIdSchema,
    targetScore: z.number(),
    bestOf: bestOfSchema,
    ranked: z.boolean(),
  }),
  players: z.array(
    pongAssignmentSchema.extend({
      userId: z.string(),
      displayName: z.string(),
      connected: z.boolean(),
      ready: z.boolean(),
    }),
  ),
  spectators: z.array(z.string()),
});
export type PongLobbyState = z.output<typeof pongLobbyStateSchema>;

export const pongPublicConfigSchema = z.object({
  width: z.number(),
  height: z.number(),
  paddleWidth: z.number(),
  paddleHeight: z.number(),
  paddleSpeed: z.number(),
  ballRadius: z.number(),
  cornerGap: z.number(),
  protocolVersion: z.number(),
  ruleset: pongRulesetIdSchema,
  arena: z.enum(PONG_ARENAS),
  targetScore: z.number(),
  bestOf: bestOfSchema,
});
export type PongPublicConfig = z.output<typeof pongPublicConfigSchema>;

export const inputPayloadSchema = z.object({
  seq: z.number().int().min(0),
  direction: z.union([z.literal(-1), z.literal(0), z.literal(1)]).optional(),
  side: pongSideSchema.optional(),
  target: z.number().optional(),
  action: z.literal('release').optional(),
});

export const readyPayloadSchema = z.object({ ready: z.boolean() });

export const lobbyConfigPayloadSchema = z.object({
  ruleset: pongRulesetIdSchema.optional().catch(undefined),
  targetScore: z.number().int().min(1).max(99).optional().catch(undefined),
  bestOf: bestOfSchema.optional().catch(undefined),
  ranked: z.boolean().optional().catch(undefined),
});

export const clientMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('input'), payload: inputPayloadSchema }),
  z.object({
    type: z.literal('ready'),
    payload: readyPayloadSchema,
  }),
  z.object({
    type: z.literal('lobby_config'),
    payload: lobbyConfigPayloadSchema,
  }),
  restartMessageSchema,
  leaveMessageSchema,
]);
export type PongClientMessage = z.output<typeof clientMessageSchema>;

export const serverMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('init'),
    payload: z.object({
      selfUserId: z.string(),
      side: pongSideSchema.nullable(),
      assignment: pongAssignmentSchema.nullable(),
      config: pongPublicConfigSchema,
      lobby: pongLobbyStateSchema,
    }),
  }),
  z.object({ type: z.literal('state'), payload: z.instanceof(Uint8Array) }),
  z.object({ type: z.literal('lobby_state'), payload: pongLobbyStateSchema }),
  restartStatusMessageSchema,
  z.object({
    type: z.literal('player_disconnected'),
    payload: pongAssignmentSchema
      .pick({ slot: true, side: true })
      .extend({ timeoutMs: z.number() }),
  }),
  z.object({
    type: z.literal('player_reconnected'),
    payload: pongAssignmentSchema.pick({ slot: true, side: true }),
  }),
]);
export type PongServerMessage = z.output<typeof serverMessageSchema>;
export type PongJsonServerMessage = Exclude<
  PongServerMessage,
  { type: 'state' }
>;
