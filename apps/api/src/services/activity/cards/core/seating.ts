// teamId is first-class on Seat (not inferred from seat parity) so a
// GameDefinition (Truco 2v2, Bridge/Hearts partnerships) can group scoring by
// team without the core engine special-casing "even/odd seats partner."
//
// `eliminated` is a turn-order concern rather than ruleset bookkeeping, which is
// why it lives here: a seat that has busted (blackjack), folded (poker), gone
// out (uno) or walked away must stop receiving turns, and only TurnOrder can
// enforce that. A seat with `playerId: null` is likewise skipped — an empty
// chair never gets the turn.
export interface Seat {
  seatIndex: number;
  playerId: string | null;
  teamId?: string;
  eliminated?: boolean;
}

export function isSeatActive(seat: Seat): boolean {
  return seat.playerId !== null && seat.eliminated !== true;
}

// Variable seat count + directional/skippable turn order, reusable by any
// GameDefinition. A GameDefinition composes TurnOrder and calls .advance() /
// mutates .direction from inside its own move handlers (e.g. Uno's "reverse"
// move flips direction) — it is not auto-driven by the engine.
//
// Mutability: mutates in place with `clone()` for GameDefinition.apply's
// immutable contract, same as Deck/Zone/ZoneSet.
export class TurnOrder {
  readonly seats: Seat[];
  currentSeat: number;
  direction: 1 | -1 = 1;
  // Queued seats that take a turn before the rotation resumes. A real queue,
  // not a "set currentSeat" helper, so "take another turn, *then* carry on
  // normally" is actually modelled — and so several extra turns can stack.
  private extraTurns: number[] = [];

  constructor(seats: readonly Seat[]) {
    // Sorted by seatIndex because `advance` treats array adjacency as table
    // adjacency while callers address seats by seatIndex. An unsorted array
    // would silently produce a wrong turn order with no error anywhere.
    this.seats = [...seats].sort((a, b) => a.seatIndex - b.seatIndex);
    this.currentSeat =
      this.seats.find(isSeatActive)?.seatIndex ?? this.seats[0]?.seatIndex ?? 0;
  }

  clone(): TurnOrder {
    const copy = new TurnOrder(this.seats.map((seat) => ({ ...seat })));
    copy.currentSeat = this.currentSeat;
    copy.direction = this.direction;
    copy.extraTurns = [...this.extraTurns];
    return copy;
  }

  get activeSeats(): Seat[] {
    return this.seats.filter(isSeatActive);
  }

  // Steps `skipCount` *active* seats along, in the current direction. Inactive
  // seats — empty chairs, busted/folded/eliminated players — are stepped over
  // rather than counted, so a disconnect can never hand the turn to nobody and
  // stall the table.
  //
  // skipCount lets a move like Uno's "skip"/"draw two" land the turn further
  // along than a plain single step.
  advance(skipCount = 1): void {
    const queued = this.extraTurns.shift();
    if (queued !== undefined) {
      this.currentSeat = queued;
      return;
    }

    const active = this.activeSeats;
    if (active.length === 0) return;

    // The current seat may itself be inactive (the player who just got
    // eliminated), so find where it sits among the active seats by scanning
    // forward from its index rather than requiring an exact match.
    const startPos = this.positionOf(this.currentSeat, active);
    const steps = Math.max(1, skipCount);
    const nextPos =
      (((startPos + steps * this.direction) % active.length) + active.length) %
      active.length;
    this.currentSeat = active[nextPos]!.seatIndex;
  }

  // Index into `active` to advance from. If the current seat is still active
  // that's just its position; if it was eliminated mid-turn we take the
  // position it *would* occupy, minus one step, so advancing lands on the seat
  // that follows it.
  private positionOf(seatIndex: number, active: Seat[]): number {
    const exact = active.findIndex((s) => s.seatIndex === seatIndex);
    if (exact !== -1) return exact;
    const following = active.findIndex((s) => s.seatIndex > seatIndex);
    const insertion = following === -1 ? active.length : following;
    return (insertion - 1 + active.length) % active.length;
  }

  // For "play again" style cards: `seatIndex` takes a turn at the next
  // advance(), and the rotation resumes from wherever it was afterwards.
  grantExtraTurn(seatIndex: number): void {
    this.extraTurns.push(seatIndex);
  }

  // Drops a seat out of the rotation (bust, fold, walkout). If it was the
  // current seat the caller still advances as usual — the eliminated seat is
  // skipped from then on.
  eliminate(seatIndex: number): void {
    const seat = this.seats.find((s) => s.seatIndex === seatIndex);
    if (seat) seat.eliminated = true;
    this.extraTurns = this.extraTurns.filter((s) => s !== seatIndex);
  }
}
