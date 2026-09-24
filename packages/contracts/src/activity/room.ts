import { z } from 'zod';
import { gameIdSchema, type GameId } from './gameId';
import { actionRejectedMessageSchema } from './protocol';

export const roomMemberRoleSchema = z.enum(['player', 'spectator', 'queued']);
export type RoomMemberRole = z.output<typeof roomMemberRoleSchema>;

export const roomMemberSchema = z.object({
  userId: z.string(),
  role: roomMemberRoleSchema,
});
export type RoomMember = z.output<typeof roomMemberSchema>;

export const roomStateSchema = z.object({
  game: gameIdSchema,
  hostUserId: z.string().nullable(),
  queueEnabled: z.boolean(),
  matchInProgress: z.boolean(),
  members: z.array(roomMemberSchema),
});
export type RoomState = z.output<typeof roomStateSchema>;

export const ROOM_STATE = 'room_state';

// Games whose rooms can queue challengers and rotate seats between matches.
const QUEUE_ELIGIBLE_GAMES: ReadonlySet<GameId> = new Set<GameId>([
  'tic-tac-toe',
  'connect-four',
  'checkers',
  'rock-paper-scissors',
  'battleship',
]);

export function isQueueEligible(game: GameId): boolean {
  return QUEUE_ELIGIBLE_GAMES.has(game);
}

export const switchGamePayloadSchema = z.object({ game: gameIdSchema });
export const toggleQueuePayloadSchema = z.object({ enabled: z.boolean() });

export const roomClientMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('switch_game'),
    payload: switchGamePayloadSchema,
  }),
  z.object({
    type: z.literal('toggle_queue'),
    payload: toggleQueuePayloadSchema,
  }),
  z.object({ type: z.literal('rotate_seat') }),
]);
export type RoomClientMessage = z.output<typeof roomClientMessageSchema>;

export const roomServerMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal(ROOM_STATE), payload: roomStateSchema }),
  actionRejectedMessageSchema,
]);
export type RoomServerMessage = z.output<typeof roomServerMessageSchema>;
