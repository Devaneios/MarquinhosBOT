// Hand-mirrored copies of the server's cards/core types
// (marquinhos-api/src/services/activity/cards/core). No shared package links the
// two repos, so these are kept in sync by hand — same pattern the client already
// uses for Pong's PaddleSide etc.
//
// On the server these shapes are the return type of
// GameDefinition.maskStateFor, so a ruleset's view is type-checked on the way
// out; this file is the matching contract on the way in.

import { z } from 'zod';

const cardSchema = z.object({
  id: z.string(),
  suit: z.string().optional(),
  rank: z.string().optional(),
  // Per-card face state, which overrides the zone's visibility in both
  // directions (a face-down card in a public pile, a face-up one in a hidden
  // pile). There is deliberately no `value`: what a card is worth is
  // game-specific, so each ruleset derives it from `rank`.
  faceUp: z.boolean().optional(),
  props: z.record(z.string(), z.unknown()).optional(),
});

export type Card = z.infer<typeof cardSchema>;

// A card the server refused to reveal to this viewer. Hidden cards keep their
// position in the zone, so a pile renders with the right number of card backs in
// the right places.
const hiddenCardSchema = z.object({ hidden: z.literal(true) });

export type HiddenCard = z.infer<typeof hiddenCardSchema>;

export type MaskedCard = Card | HiddenCard;

export function isHiddenCard(card: MaskedCard): card is HiddenCard {
  return 'hidden' in card && card.hidden;
}

// One zone (hand, discard, stock, ...) as this viewer is allowed to see it.
const zoneViewSchema = z.object({
  id: z.string(),
  owner: z.string(),
  count: z.number(),
  cards: z.array(z.union([hiddenCardSchema, cardSchema])),
});

export type ZoneView = z.infer<typeof zoneViewSchema>;

const seatSchema = z.object({
  seatIndex: z.number(),
  playerId: z.string().nullable(),
  teamId: z.string().optional(),
  eliminated: z.boolean().optional(),
});

export type Seat = z.infer<typeof seatSchema>;

const legalMoveSchema = z.object({
  move: z.string(),
  args: z.unknown().optional(),
});

export type LegalMove = z.infer<typeof legalMoveSchema>;

// The shape every ruleset's masked view shares — and all the generic table needs
// in order to render seats, hands, the played cards and the legal-move buttons.
//
// There is no `[key: string]: unknown` index signature: it would silently accept
// every typo'd field access across the whole component tree. A ruleset with
// extra fields extends this instead (see TrucoView), and the presentation module
// for that ruleset is the only place that reads them.
export const tableViewSchema = z.object({
  seats: z.array(seatSchema),
  hands: z.record(z.number(), zoneViewSchema),
  table: z.array(z.object({ seatIndex: z.number(), card: cardSchema })),
  currentSeat: z.number(),
  legalMoves: z.array(legalMoveSchema),
  handOver: z.boolean(),
});

export type TableView = z.infer<typeof tableViewSchema>;

const teamSchema = z.enum(['A', 'B']);

export type Team = z.infer<typeof teamSchema>;

export const trucoViewSchema = tableViewSchema.extend({
  vira: cardSchema.nullable(),
  discardCount: z.number(),
  trickResults: z.array(z.union([teamSchema, z.literal('tie')])),
  currentStake: z.number(),
  pendingCallLevel: z.number().nullable(),
  callingTeam: teamSchema.nullable(),
  matchScore: z.object({ A: z.number(), B: z.number() }),
  forfeitedTeam: teamSchema.nullable(),
  winningScore: z.number(),
});

export type TrucoView = z.infer<typeof trucoViewSchema>;

// Server → client messages the generic table understands. Every ruleset gets
// these for free.
const scoreboardEntrySchema = z.object({
  userId: z.string(),
  position: z.number(),
  points: z.number().optional(),
});

export type ScoreboardEntry = z.infer<typeof scoreboardEntrySchema>;

export const matchOverPayloadSchema = z.object({
  scoreboard: z.array(scoreboardEntrySchema),
});

export const disconnectNoticeSchema = z.object({
  userId: z.string(),
  seatIndex: z.number(),
  timeoutMs: z.number(),
});

export type DisconnectNotice = z.infer<typeof disconnectNoticeSchema>;

export const initPayloadSchema = z.object({
  seatIndex: z.number().nullable(),
});

export const moveRejectedPayloadSchema = z
  .object({ reason: z.string().optional() })
  .optional();

export const turnTimeoutPayloadSchema = z.object({ userId: z.string() });
