import type { Card } from 'services/activity/cards/core/card';

// The shared rank/suit vocabulary. Exported because a ruleset's ordering must
// be built from the *same* vocabulary the deck is built from — truco's
// RANK_ORDER covering a different rank set than spanishSuitedDeck() produces is
// exactly the kind of silent mismatch that scores a card as "weakest" instead
// of failing loudly.
export const FRENCH_SUITS = ['♠', '♥', '♦', '♣'] as const;
export const FRENCH_RANKS = [
  'A',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'J',
  'Q',
  'K',
] as const;

export const SPANISH_SUITS = ['espadas', 'copas', 'ouros', 'paus'] as const;
// The 40-card Spanish-suited set as used by truco: 8/9/10 are absent from the
// deck entirely rather than "removed at deal time", so this constant *is* the
// rank vocabulary a truco-family ruleset orders.
export const SPANISH_RANKS = [
  'A',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  'J',
  'Q',
  'K',
] as const;

export interface DeckOptions {
  // Blackjack shoes (6-8), canasta (2). Card ids stay unique across copies,
  // which is the whole reason Card.id exists separately from suit+rank.
  decks?: number;
}

// Ids are derived, never random: `${suit}-${rank}-${copy}`. A seeded shuffle
// over randomUUID-identified cards reproduces order but not identity, so no
// snapshot, log or client card reference survives a replay — deterministic ids
// are a precondition for SeededRng's entire purpose.
function cardId(suit: string, rank: string, copy: number): string {
  return `${suit}-${rank}-${copy}`;
}

function copiesOf(options: DeckOptions): number {
  return Math.max(1, Math.floor(options.decks ?? 1));
}

// Pure builders of known deck shapes as Card[] — seed data that composes with
// Deck/Zone.
export function standardFrenchDeck(
  options: DeckOptions & { jokers?: number } = {},
): Card[] {
  const cards: Card[] = [];
  const copies = copiesOf(options);
  for (let copy = 0; copy < copies; copy++) {
    for (const suit of FRENCH_SUITS) {
      for (const rank of FRENCH_RANKS) {
        cards.push({ id: cardId(suit, rank, copy), suit, rank });
      }
    }
    // Jokers alternate red/black rather than sharing one suitless identity:
    // two jokers that differ only by id collapse into each other under any
    // suit/rank-keyed lookup, and games that use both (canasta, euchre) need to
    // tell them apart.
    const jokers = Math.max(0, options.jokers ?? 0);
    for (let i = 0; i < jokers; i++) {
      const suit = i % 2 === 0 ? 'red' : 'black';
      cards.push({
        id: cardId(suit, 'JOKER', copy * jokers + i),
        suit,
        rank: 'JOKER',
      });
    }
  }
  return cards;
}

// Truco's 40-card deck. The rank labels stay French (J/Q/K rather than
// sota/caballo/rey) because the client's CardFace renders them and the whole
// stack shares one vocabulary; what matters to the rules is the 10 ranks x 4
// suits shape. `extraRemovedRanks` covers regional variants that drop more.
export function spanishSuitedDeck(
  options: DeckOptions & { extraRemovedRanks?: readonly string[] } = {},
): Card[] {
  const removed = new Set(options.extraRemovedRanks ?? []);
  const cards: Card[] = [];
  const copies = copiesOf(options);
  for (let copy = 0; copy < copies; copy++) {
    for (const suit of SPANISH_SUITS) {
      for (const rank of SPANISH_RANKS) {
        if (removed.has(rank)) continue;
        cards.push({ id: cardId(suit, rank, copy), suit, rank });
      }
    }
  }
  return cards;
}

// Escape hatch for homebrew/TCG decks: the caller supplies every card's
// suit/rank/props and the factory only assigns ids. TProps lets a TCG ruleset
// get typed access to its own props instead of the default untyped bag — e.g.
// customDeck<SpellProps>([...]).
export function customDeck<TProps = Record<string, unknown>>(
  cards: readonly Omit<Card<TProps>, 'id'>[],
  options: DeckOptions = {},
): Card<TProps>[] {
  const out: Card<TProps>[] = [];
  const copies = copiesOf(options);
  for (let copy = 0; copy < copies; copy++) {
    cards.forEach((card, index) => {
      const label = card.suit ?? card.rank ?? `card${index}`;
      out.push({ ...card, id: cardId(label, String(index), copy) });
    });
  }
  return out;
}
