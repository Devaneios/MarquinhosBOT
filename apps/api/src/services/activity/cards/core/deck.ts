import type { Card } from 'services/activity/cards/core/card';
import type { SeededRng } from 'services/activity/cards/core/rng';

// THE ordered-pile-of-cards data structure. Every Zone composes one, so there
// is exactly one implementation of "pile" in the engine — a hand, a discard, a
// stock, a trick-in-progress and a TCG library all get shuffle/draw/insert for
// free and cannot drift apart. The end of the internal array is "top" (cheap
// push/pop for draw/deal).
//
// Mutability: Deck mutates in place, and `clone()` is how it participates in
// GameDefinition.apply's immutable contract — see that file's contract note.
// Every mutator here is paired with the guarantee that clone() gives you an
// independent pile to mutate. TProps threads through to Card<TProps> so a
// ruleset with typed custom card props (Deck<SpellProps>) keeps that typing.
export class Deck<TProps = Record<string, unknown>> {
  private cards: Card<TProps>[];

  constructor(cards: readonly Card<TProps>[] = []) {
    this.cards = [...cards];
  }

  get size(): number {
    return this.cards.length;
  }

  // Cards are treated as immutable values, so a shallow copy of the array is a
  // genuinely independent pile.
  clone(): Deck<TProps> {
    return new Deck<TProps>(this.cards);
  }

  drawTop(): Card<TProps> | undefined {
    return this.cards.pop();
  }

  drawBottom(): Card<TProps> | undefined {
    return this.cards.shift();
  }

  // Top-first. `n` is clamped at both ends: peekTop(0) is empty and
  // peekTop(999) is the whole pile. The clamp is not cosmetic — `slice(-n)`
  // with n === 0 is `slice(0)`, which silently returns *every* card, so the
  // obvious implementation leaks a whole deck to any caller asking for none.
  peekTop(n: number): Card<TProps>[] {
    if (n <= 0) return [];
    return this.cards.slice(-n).reverse();
  }

  insertTop(cards: readonly Card<TProps>[]): void {
    this.cards.push(...cards);
  }

  insertBottom(cards: readonly Card<TProps>[]): void {
    this.cards.unshift(...cards);
  }

  // Counting from the top (index 0 === top), for effects that place a card a
  // fixed distance down the pile: rummy melds, TCG scry/"put it second from
  // the top". Out-of-range indices clamp rather than throw.
  insertAt(indexFromTop: number, cards: readonly Card<TProps>[]): void {
    const clamped = Math.max(0, Math.min(indexFromTop, this.cards.length));
    this.cards.splice(this.cards.length - clamped, 0, ...cards);
  }

  // Returns the removed cards **in the order they were requested**, not in
  // pile order. A move that plays two cards in a caller-chosen sequence must
  // not have that sequence silently rewritten by the pile's own layout. Ids
  // not present are skipped.
  remove(cardIds: readonly string[]): Card<TProps>[] {
    const byId = new Map(this.cards.map((c) => [c.id, c]));
    const removed: Card<TProps>[] = [];
    for (const id of cardIds) {
      const card = byId.get(id);
      if (card) removed.push(card);
    }
    if (removed.length > 0) {
      const removedIds = new Set(removed.map((c) => c.id));
      this.cards = this.cards.filter((c) => !removedIds.has(c.id));
    }
    return removed;
  }

  shuffle(rng: SeededRng): void {
    this.cards = rng.shuffle(this.cards);
  }

  toArray(): Card<TProps>[] {
    return [...this.cards];
  }
}
