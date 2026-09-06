import type { Card } from 'services/activity/cards/core/card';
import { SPANISH_RANKS } from 'services/activity/cards/core/deckFactory';

// Card-strength ranking is Truco-specific rule logic, not a universal baralho
// concept — it lives only in this ruleset, not in core/. Weakest to strongest.
export const RANK_ORDER = [
  '4',
  '5',
  '6',
  '7',
  'Q',
  'J',
  'K',
  'A',
  '2',
  '3',
] as const;

// The ordering and the deck must describe the same 10 ranks. They are declared in
// two files — the deck vocabulary in core/, the ordering here — so this asserts
// at import time that they have not drifted. Without it, a rank present in the
// deck but missing from RANK_ORDER scores as `indexOf` → -1, i.e. silently
// weaker than every real card, and the only symptom is a trick that resolves
// wrongly now and then.
const orderedRanks = new Set<string>(RANK_ORDER);
const deckRanks = new Set<string>(SPANISH_RANKS);
if (
  orderedRanks.size !== deckRanks.size ||
  [...deckRanks].some((rank) => !orderedRanks.has(rank))
) {
  throw new Error(
    `truco RANK_ORDER (${[...orderedRanks].join(',')}) does not cover the deck ranks (${[...deckRanks].join(',')})`,
  );
}

const SUIT_STRENGTH: Record<string, number> = {
  ouros: 0,
  espadas: 1,
  copas: 2,
  paus: 3,
};

// The manilha (trump) rank is whichever rank comes right after the vira's rank
// in Truco's rank order, wrapping around from '3' back to '4'.
export function manilhaRank(viraRank: string): string {
  const idx = RANK_ORDER.indexOf(viraRank as (typeof RANK_ORDER)[number]);
  // -1 would wrap to RANK_ORDER[0] and quietly nominate '4' as the manilha, so
  // an unknown vira is reported rather than guessed.
  if (idx === -1) {
    throw new Error(`Unknown vira rank "${viraRank}" for truco ranking`);
  }
  return RANK_ORDER[(idx + 1) % RANK_ORDER.length]!;
}

// Higher is stronger. Manilhas always outrank every plain card; among manilhas,
// suit breaks the tie (ouros < espadas < copas < paus). Two plain cards of the
// same rank (different suit) are equal strength — a real tie, resolved by the
// trick/hand-level tie-carry rule, not here.
export function cardStrength(card: Card, manilha: string): number {
  const rank = card.rank ?? '';
  if (rank === manilha) {
    return 100 + (SUIT_STRENGTH[card.suit ?? ''] ?? 0);
  }
  const strength = RANK_ORDER.indexOf(rank as (typeof RANK_ORDER)[number]);
  if (strength === -1) {
    throw new Error(`Card rank "${rank}" is outside truco's rank order`);
  }
  return strength;
}
