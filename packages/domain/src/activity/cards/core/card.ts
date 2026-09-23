// The atomic unit every other card-engine primitive operates on. `id` is
// always present and unique within a deal — needed to track one physical card
// through shuffles/zone moves even when two cards share suit+rank (jokers,
// multi-deck games). Ids are *derived* from suit/rank/copy rather than random
// (see deckFactory), because a seeded shuffle over randomly-identified cards
// reproduces order but not identity, which is not a replay.
//
// `suit`/`rank` are the vocabulary shared by the vast majority of card games
// (any trick-taking game, poker, rummy, blackjack, Uno).
//
// There is deliberately no `value` field. What a card is "worth" is
// game-specific and irreconcilable across games — blackjack's ace is 1 *or*
// 11, rummy's face cards are all 10, trick-taking strength is an ordering
// rather than a scalar — so each ruleset derives it from `rank` (see truco's
// RANK_ORDER). A blessed field every game reinterprets is a second source of
// truth, not a shared concept.
//
// `faceUp` is per-card because zone-level visibility cannot express a pile
// holding a mix of face-up and face-down cards: blackjack's dealer hole card,
// a TCG's face-down creature, truco's face-down "carta virada". `undefined`
// means "inherit the zone's visibility", which is the common case; `true`
// forces the card visible even in a hidden zone and `false` forces it hidden
// even in a public one.
//
// `props` is the escape hatch for TCG/homebrew cards (mana cost, card text,
// custom stats) that don't fit that shape. TProps defaults to an untyped bag
// so every caller of the bare `Card` alias keeps compiling, but a ruleset that
// wants type safety on its own custom data can declare `Card<MyCardProps>`.
export interface Card<TProps = Record<string, unknown>> {
  id: string;
  suit?: string;
  rank?: string;
  faceUp?: boolean;
  props?: TProps;
}
