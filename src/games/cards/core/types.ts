// Hand-mirrored copies of the server's cards/core types
// (marquinhos-api/src/services/activity/cards/core). No shared package links the
// two repos, so these are kept in sync by hand — same pattern the client already
// uses for Pong's PaddleSide etc.
//
// On the server these shapes are the return type of
// GameDefinition.maskStateFor, so a ruleset's view is type-checked on the way
// out; this file is the matching contract on the way in.

export interface Card {
  id: string;
  suit?: string;
  rank?: string;
  // Per-card face state, which overrides the zone's visibility in both
  // directions (a face-down card in a public pile, a face-up one in a hidden
  // pile). There is deliberately no `value`: what a card is worth is
  // game-specific, so each ruleset derives it from `rank`.
  faceUp?: boolean;
  props?: Record<string, unknown>;
}

// A card the server refused to reveal to this viewer. Hidden cards keep their
// position in the zone, so a pile renders with the right number of card backs in
// the right places.
export interface HiddenCard {
  hidden: true;
}

export type MaskedCard = Card | HiddenCard;

export function isHiddenCard(card: MaskedCard): card is HiddenCard {
  return (card as HiddenCard).hidden === true;
}

// One zone (hand, discard, stock, ...) as this viewer is allowed to see it.
export interface ZoneView {
  id: string;
  owner: 'shared' | string;
  count: number;
  cards: MaskedCard[];
}

export interface Seat {
  seatIndex: number;
  playerId: string | null;
  teamId?: string;
  eliminated?: boolean;
}

export interface LegalMove {
  move: string;
  args?: unknown;
}

// The shape every ruleset's masked view shares — and all the generic table needs
// in order to render seats, hands, the played cards and the legal-move buttons.
//
// There is no `[key: string]: unknown` index signature: it would silently accept
// every typo'd field access across the whole component tree. A ruleset with
// extra fields extends this instead (see TrucoView), and the presentation module
// for that ruleset is the only place that reads them.
export interface TableView {
  seats: Seat[];
  hands: Record<number, ZoneView>;
  table: { seatIndex: number; card: Card }[];
  currentSeat: number;
  legalMoves: LegalMove[];
  handOver: boolean;
}

export type Team = 'A' | 'B';

export interface TrucoView extends TableView {
  vira: Card | null;
  discardCount: number;
  trickResults: (Team | 'tie')[];
  currentStake: number;
  pendingCallLevel: number | null;
  callingTeam: Team | null;
  matchScore: Record<Team, number>;
  forfeitedTeam: Team | null;
  winningScore: number;
}

// Server → client messages the generic table understands. Every ruleset gets
// these for free.
export interface ScoreboardEntry {
  userId: string;
  position: number;
  points?: number;
}

export interface RestartStatus {
  votes: number;
  required: number;
}

export interface DisconnectNotice {
  userId: string;
  seatIndex: number;
  timeoutMs: number;
}
