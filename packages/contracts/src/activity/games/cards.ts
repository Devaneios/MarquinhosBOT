import { z } from 'zod';
import {
  leaveMessageSchema,
  restartMessageSchema,
  restartStatusMessageSchema,
} from '../protocol';

export const cardSchema = z.object({
  id: z.string(),
  suit: z.string().optional(),
  rank: z.string().optional(),
  faceUp: z.boolean().optional(),
  props: z.record(z.string(), z.unknown()).optional(),
});
export type Card = z.output<typeof cardSchema>;

export const hiddenCardSchema = z.object({ hidden: z.literal(true) });
export type HiddenCard = z.output<typeof hiddenCardSchema>;

export type MaskedCard = Card | HiddenCard;

export function isHiddenCard(card: MaskedCard): card is HiddenCard {
  return 'hidden' in card && card.hidden;
}

export const zoneViewSchema = z.object({
  id: z.string(),
  owner: z.string(),
  count: z.number(),
  cards: z.array(z.union([hiddenCardSchema, cardSchema])),
});
export type ZoneView = z.output<typeof zoneViewSchema>;

export const seatSchema = z.object({
  seatIndex: z.number(),
  playerId: z.string().nullable(),
  teamId: z.string().optional(),
  eliminated: z.boolean().optional(),
});
export type Seat = z.output<typeof seatSchema>;

export const legalMoveSchema = z.object({
  move: z.string(),
  args: z.unknown().optional(),
});
export type LegalMove = z.output<typeof legalMoveSchema>;

export const tableViewSchema = z.object({
  seats: z.array(seatSchema),
  hands: z.record(z.number(), zoneViewSchema),
  table: z.array(z.object({ seatIndex: z.number(), card: cardSchema })),
  currentSeat: z.number(),
  legalMoves: z.array(legalMoveSchema),
  handOver: z.boolean(),
});
export type TableView = z.output<typeof tableViewSchema>;

export const teamSchema = z.enum(['A', 'B']);
export type Team = z.output<typeof teamSchema>;

export const trickResultSchema = z.union([teamSchema, z.literal('tie')]);
export type TrickResult = z.output<typeof trickResultSchema>;

export const trucoViewSchema = tableViewSchema.extend({
  vira: cardSchema.nullable(),
  discardCount: z.number(),
  trickResults: z.array(trickResultSchema),
  currentStake: z.number(),
  pendingCallLevel: z.number().nullable(),
  callingTeam: teamSchema.nullable(),
  matchScore: z.object({ A: z.number(), B: z.number() }),
  forfeitedTeam: teamSchema.nullable(),
  winningScore: z.number(),
});
export type TrucoView = z.output<typeof trucoViewSchema>;

export const scoreboardEntrySchema = z.object({
  userId: z.string(),
  position: z.number(),
  points: z.number().optional(),
});
export type ScoreboardEntry = z.output<typeof scoreboardEntrySchema>;

export const disconnectNoticeSchema = z.object({
  userId: z.string(),
  seatIndex: z.number(),
  timeoutMs: z.number(),
});
export type DisconnectNotice = z.output<typeof disconnectNoticeSchema>;

export const movePayloadSchema = z.object({
  move: z.string().min(1),
  args: z.unknown().optional(),
});

export const clientMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('move'), payload: movePayloadSchema }),
  restartMessageSchema,
  leaveMessageSchema,
]);
export type CardsClientMessage = z.output<typeof clientMessageSchema>;

export const serverMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('init'),
    payload: z.object({ seatIndex: z.number().nullable() }),
  }),
  z.object({ type: z.literal('state'), payload: tableViewSchema.loose() }),
  z.object({
    type: z.literal('move_rejected'),
    payload: z.object({ reason: z.string() }),
  }),
  z.object({ type: z.literal('round_over') }),
  z.object({
    type: z.literal('match_over'),
    payload: z.object({ scoreboard: z.array(scoreboardEntrySchema) }),
  }),
  restartStatusMessageSchema,
  z.object({
    type: z.literal('turn_timeout'),
    payload: z.object({ userId: z.string() }),
  }),
  z.object({
    type: z.literal('opponent_disconnected'),
    payload: disconnectNoticeSchema,
  }),
  z.object({
    type: z.literal('opponent_reconnected'),
    payload: z.object({ userId: z.string(), seatIndex: z.number() }),
  }),
]);
export type CardsServerMessage = z.output<typeof serverMessageSchema>;
