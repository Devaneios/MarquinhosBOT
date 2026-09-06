import type { Card } from 'services/activity/cards/core/card';
import { Deck } from 'services/activity/cards/core/deck';
import type { SeededRng } from 'services/activity/cards/core/rng';
import type { Seat } from 'services/activity/cards/core/seating';

// How much of a zone a given viewer may see. Deliberately not "boolean
// visible": the count of cards in an opponent's hand is public in every card
// game ever played, and a discard pile shows its top card only, so the
// interesting answers are all partial.
export type VisibilityLevel = 'full' | 'count' | 'top';

// Visibility is a *predicate*, not an enum member, because real games need
// relations a fixed union can't express: "my team can see it" (bridge's dummy,
// truco variants where partners show cards) and — the case that settles the
// argument — Hanabi, where everyone *except* the owner sees the card. Adding a
// union member per game would never converge; a function does.
//
// `viewer` is null for a spectator, `owner` is null for a shared/table zone.
export type VisibilityRule = (
  viewer: Seat | null,
  owner: Seat | null,
) => VisibilityLevel;

function sameSeat(a: Seat | null, b: Seat | null): boolean {
  return a !== null && b !== null && a.seatIndex === b.seatIndex;
}

// The named presets covering the common cases, so a ruleset declares intent
// (`Visibility.ownerOnly`) rather than writing a lambda. These are the four
// original ZoneVisibility values plus the two relations that were missing.
export const Visibility = {
  // Community cards, a played trick, a face-up tableau.
  public: (): VisibilityLevel => 'full',
  // A stock/library: everyone knows how many, nobody sees which.
  hidden: (): VisibilityLevel => 'count',
  // A hand: its holder sees it, everyone else sees a count.
  ownerOnly: (viewer: Seat | null, owner: Seat | null): VisibilityLevel =>
    sameSeat(viewer, owner) ? 'full' : 'count',
  // A discard pile: the top card is public, the rest is history.
  topOnly: (): VisibilityLevel => 'top',
  // Bridge's dummy, partnership games where partners share information.
  teamOnly: (viewer: Seat | null, owner: Seat | null): VisibilityLevel =>
    viewer !== null &&
    owner !== null &&
    viewer.teamId !== undefined &&
    viewer.teamId === owner.teamId
      ? 'full'
      : 'count',
  // Hanabi: you are the only person who cannot see your own cards.
  othersOnly: (viewer: Seat | null, owner: Seat | null): VisibilityLevel =>
    sameSeat(viewer, owner) ? 'count' : 'full',
} satisfies Record<string, VisibilityRule>;

export interface ZoneConfig {
  id: string;
  // 'shared' for a table-wide zone (discard, stock, trick-in-progress);
  // a playerId for a per-player zone (hand, trick-pile).
  owner: 'shared' | string;
  visibility: VisibilityRule;
}

// The generalization of "hand" / "discard pile" / "stock" / "trick pile" /
// "board slot": a named, owned, visibility-tagged pile. Zone owns the identity
// and access rules; the card storage itself is delegated to Deck so there is
// only one pile implementation in the engine (that delegation is also what
// gives every zone shuffle/draw, which poker's community deal and rummy's
// stock both need).
//
// Zone stores and mutates; turning `visibility` into an actual per-viewer view
// is `maskZones()` in masking.ts — one tested implementation shared by every
// ruleset, rather than each ruleset hand-rolling the engine's only security
// boundary.
export class Zone<TProps = Record<string, unknown>> {
  private pile: Deck<TProps>;

  constructor(
    public readonly config: ZoneConfig,
    cards: readonly Card<TProps>[] = [],
  ) {
    this.pile = new Deck<TProps>(cards);
  }

  // Read-only by design: `moveTo`/`add`/`remove` are the only mutation path, so
  // a ruleset cannot accidentally desynchronize a zone from the move that was
  // supposed to have produced it.
  get cards(): readonly Card<TProps>[] {
    return this.pile.toArray();
  }

  get size(): number {
    return this.pile.size;
  }

  clone(): Zone<TProps> {
    return new Zone<TProps>(this.config, this.pile.toArray());
  }

  add(
    cards: readonly Card<TProps>[],
    position: 'top' | 'bottom' = 'top',
  ): void {
    if (position === 'top') this.pile.insertTop(cards);
    else this.pile.insertBottom(cards);
  }

  // Removed cards come back in requested order — see Deck.remove.
  remove(cardIds: readonly string[]): Card<TProps>[] {
    return this.pile.remove(cardIds);
  }

  drawTop(): Card<TProps> | undefined {
    return this.pile.drawTop();
  }

  peekTop(n: number): Card<TProps>[] {
    return this.pile.peekTop(n);
  }

  shuffle(rng: SeededRng): void {
    this.pile.shuffle(rng);
  }

  // The atomic card-game operation: cards leave one pile and arrive in another,
  // preserving the requested order.
  moveTo(
    target: Zone<TProps>,
    cardIds: readonly string[],
    position: 'top' | 'bottom' = 'top',
  ): void {
    target.add(this.remove(cardIds), position);
  }
}
