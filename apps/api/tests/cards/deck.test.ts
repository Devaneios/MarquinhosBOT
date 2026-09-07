import { describe, expect, it } from 'bun:test';
import type { Card } from 'services/activity/cards/core/card';
import { Deck } from 'services/activity/cards/core/deck';
import { SeededRng } from 'services/activity/cards/core/rng';

function cards(...ids: string[]): Card[] {
  return ids.map((id) => ({ id }));
}

describe('Deck', () => {
  it('draws from the top (end of the array)', () => {
    const deck = new Deck(cards('a', 'b', 'c'));
    expect(deck.drawTop()?.id).toBe('c');
    expect(deck.drawTop()?.id).toBe('b');
    expect(deck.size).toBe(1);
  });

  it('draws from the bottom', () => {
    const deck = new Deck(cards('a', 'b', 'c'));
    expect(deck.drawBottom()?.id).toBe('a');
    expect(deck.size).toBe(2);
  });

  it('returns undefined drawing from an empty deck', () => {
    const deck = new Deck([]);
    expect(deck.drawTop()).toBeUndefined();
    expect(deck.drawBottom()).toBeUndefined();
  });

  it('peeks the top n cards without removing them', () => {
    const deck = new Deck(cards('a', 'b', 'c'));
    const peeked = deck.peekTop(2).map((c) => c.id);
    expect(peeked).toEqual(['c', 'b']);
    expect(deck.size).toBe(3);
  });

  it('peekTop(0) returns nothing rather than the whole deck', () => {
    // `slice(-0)` is `slice(0)`, so the obvious implementation hands back every
    // card to a caller that asked for none — a whole-deck leak from a primitive
    // whose entire job is controlling what is visible.
    const deck = new Deck(cards('a', 'b', 'c'));
    expect(deck.peekTop(0)).toEqual([]);
    expect(deck.peekTop(-1)).toEqual([]);
  });

  it('peeks fewer cards than requested rather than overrunning', () => {
    const deck = new Deck(cards('a'));
    expect(deck.peekTop(5).map((c) => c.id)).toEqual(['a']);
  });

  it('removes cards in the order they were requested', () => {
    const deck = new Deck(cards('a', 'b', 'c'));
    expect(deck.remove(['c', 'a']).map((c) => c.id)).toEqual(['c', 'a']);
    expect(deck.toArray().map((c) => c.id)).toEqual(['b']);
  });

  it('inserts at a given depth from the top (scry / meld placement)', () => {
    const deck = new Deck(cards('bottom', 'top'));
    deck.insertAt(1, cards('second'));
    expect(deck.peekTop(3).map((c) => c.id)).toEqual([
      'top',
      'second',
      'bottom',
    ]);
  });

  it('clone() yields an independent pile', () => {
    const original = new Deck(cards('a', 'b'));
    const copy = original.clone();
    copy.drawTop();
    expect(copy.size).toBe(1);
    expect(original.size).toBe(2);
  });

  it('inserts cards at the top and bottom', () => {
    const deck = new Deck(cards('a'));
    deck.insertTop(cards('b'));
    deck.insertBottom(cards('c'));
    expect(deck.toArray().map((c) => c.id)).toEqual(['c', 'a', 'b']);
  });

  it('shuffles deterministically given a seeded rng', () => {
    const deckA = new Deck(cards('a', 'b', 'c', 'd', 'e'));
    const deckB = new Deck(cards('a', 'b', 'c', 'd', 'e'));

    deckA.shuffle(new SeededRng(5));
    deckB.shuffle(new SeededRng(5));

    expect(deckA.toArray()).toEqual(deckB.toArray());
  });

  it('size reflects the current card count', () => {
    const deck = new Deck(cards('a', 'b'));
    expect(deck.size).toBe(2);
    deck.drawTop();
    expect(deck.size).toBe(1);
  });

  it('preserves a caller-supplied props type without casting', () => {
    interface SpellProps {
      manaCost: number;
    }
    const deck = new Deck<SpellProps>([{ id: 'a', props: { manaCost: 3 } }]);
    const drawn = deck.drawTop()!;
    // No cast needed: props is typed as SpellProps, not Record<string, unknown>.
    const manaCost: number = drawn.props!.manaCost;
    expect(manaCost).toBe(3);
  });
});
