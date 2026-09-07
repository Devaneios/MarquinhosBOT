import { isSeatActive, type Seat } from 'services/activity/cards/core/seating';

// After "move a card", the most common mechanic in card games is that the turn
// *leaves the rotation* while a specific set of players owes an answer:
//
//   truco     — call_truco, and the opposing team owes accept/raise/fold
//   poker     — a bet, and everyone still in owes call/raise/fold
//   bridge    — the bidding round before play begins
//   blackjack — the insurance offer
//   uno       — "choose a colour" after a wild, and stacked draw-twos
//
// Every one of those is the same shape, so it is modelled once here rather than
// hand-rolled into each ruleset's state (which is what truco's original
// `pendingCallLevel`/`callingTeam` pair was). It deliberately sits *alongside*
// TurnOrder rather than inside it: a pending response suspends the rotation, it
// doesn't reorder it, and keeping them separate means `legalMoves` can ask the
// two questions independently.
//
// Plain data with pure helpers, so it costs nothing to hold in an immutable
// ruleset state and can be spread-copied like any other field.
export interface PendingResponse<TData = unknown> {
  // Who opened it — the seat that bet/called/played the wild.
  initiatorSeat: number;
  // Seats that owe an answer. Any one of them answering resolves it, which is
  // what makes team responses (truco) and multi-player betting rounds both
  // expressible.
  respondingSeats: number[];
  // Move ids allowed while this is open. The engine doesn't interpret these —
  // `legalMoves` and the ruleset's own validate() do — but keeping them here
  // means "what can I do right now" has one answer, not one per move handler.
  allowedMoves: string[];
  // Where the rotation resumes once resolved. Without this, resolving a
  // pending response has to guess whose turn it was, and guesses differ
  // between the accept path and the fold path.
  resumeSeat: number;
  // Ruleset payload: truco's stake level, poker's amount to call, the wild
  // card's chosen colour.
  data: TData;
}

export function openResponse<TData>(
  input: PendingResponse<TData>,
): PendingResponse<TData> {
  return { ...input };
}

// Whether this seat is one of the seats that owes an answer.
export function owesResponse(
  pending: PendingResponse | null,
  seatIndex: number,
): boolean {
  return pending !== null && pending.respondingSeats.includes(seatIndex);
}

// Whether `move` is permitted while this response is outstanding. With no
// pending response every move is allowed as far as this primitive is concerned
// — the ruleset's own validate() still has the final say.
export function allowsMove(
  pending: PendingResponse | null,
  move: string,
): boolean {
  return pending === null || pending.allowedMoves.includes(move);
}

// Every active seat belonging to a team other than the initiator's — the
// responding set for a partnership game like truco.
export function opposingTeamSeats(
  seats: readonly Seat[],
  initiatorSeat: number,
): number[] {
  const initiatorTeam = seats.find(
    (s) => s.seatIndex === initiatorSeat,
  )?.teamId;
  return seats
    .filter((s) => isSeatActive(s) && s.teamId !== initiatorTeam)
    .map((s) => s.seatIndex);
}
