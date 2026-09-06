import { describe, expect, it } from 'bun:test';
import type { Card } from 'services/activity/cards/core/card';
import { SeededRng } from 'services/activity/cards/core/rng';
import { Visibility, Zone } from 'services/activity/cards/core/zone';

function cards(...ids: string[]): Card[] {
  return ids.map((id) => ({ id }));
}

const hand = { id: 'hand', owner: 'p1', visibility: Visibility.ownerOnly };
const table = { id: 'table', owner: 'shared', visibility: Visibility.public };

describe('Zone', () => {
  it('starts with the cards it was configured with', () => {
    const zone = new Zone(hand, cards('a', 'b'));
    expect(zone.cards.map((c) => c.id)).toEqual(['a', 'b']);
    expect(zone.config.id).toBe('hand');
  });

  it('adds cards at the top or bottom', () => {
    const zone = new Zone(table, cards('a'));
    zone.add(cards('b'), 'top');
    zone.add(cards('z'), 'bottom');
    expect(zone.cards.map((c) => c.id)).toEqual(['z', 'a', 'b']);
  });

  it('removes cards by id', () => {
    const zone = new Zone(hand, cards('a', 'b', 'c'));
    const removed = zone.remove(['b']);
    expect(removed.map((c) => c.id)).toEqual(['b']);
    expect(zone.cards.map((c) => c.id)).toEqual(['a', 'c']);
  });

  it('returns removed cards in the order they were requested, not pile order', () => {
    // A move that plays several cards in a chosen sequence must not have that
    // sequence silently rewritten by however the pile happens to be laid out.
    const zone = new Zone(hand, cards('a', 'b', 'c'));
    const removed = zone.remove(['c', 'a']);
    expect(removed.map((c) => c.id)).toEqual(['c', 'a']);
  });

  it('ignores ids that are not in the zone', () => {
    const zone = new Zone(hand, cards('a'));
    expect(zone.remove(['nope']).length).toBe(0);
    expect(zone.size).toBe(1);
  });

  it('moves cards to another zone by id, preserving requested order', () => {
    const from = new Zone(hand, cards('a', 'b', 'c'));
    const to = new Zone(table, []);
    from.moveTo(to, ['c', 'a'], 'top');
    expect(from.cards.map((c) => c.id)).toEqual(['b']);
    expect(to.cards.map((c) => c.id)).toEqual(['c', 'a']);
  });

  it('delegates pile operations to its Deck (draw, peek and shuffle)', () => {
    const zone = new Zone(table, cards('a', 'b', 'c'));
    expect(zone.drawTop()?.id).toBe('c');
    expect(zone.peekTop(1).map((c) => c.id)).toEqual(['b']);

    const other = new Zone(table, cards('a', 'b', 'c', 'd', 'e'));
    const mirror = new Zone(table, cards('a', 'b', 'c', 'd', 'e'));
    other.shuffle(new SeededRng(7));
    mirror.shuffle(new SeededRng(7));
    expect(other.cards).toEqual(mirror.cards);
  });

  it('clone() yields an independent zone, so apply() cannot rewrite history', () => {
    const original = new Zone(hand, cards('a', 'b'));
    const copy = original.clone();
    copy.remove(['a']);
    expect(copy.cards.map((c) => c.id)).toEqual(['b']);
    expect(original.cards.map((c) => c.id)).toEqual(['a', 'b']);
  });

  it('preserves a caller-supplied props type without casting', () => {
    interface SpellProps {
      manaCost: number;
    }
    const zone = new Zone<SpellProps>(hand, [
      { id: 'a', props: { manaCost: 3 } },
    ]);
    // No cast needed: props is typed as SpellProps, not Record<string, unknown>.
    const manaCost: number = zone.cards[0]!.props!.manaCost;
    expect(manaCost).toBe(3);
  });
});

describe('Visibility presets', () => {
  const p1 = { seatIndex: 0, playerId: 'p1', teamId: 'A' };
  const partner = { seatIndex: 2, playerId: 'p3', teamId: 'A' };
  const opponent = { seatIndex: 1, playerId: 'p2', teamId: 'B' };

  it('public is full for everyone, including a spectator', () => {
    expect(Visibility.public()).toBe('full');
  });

  it('hidden is a count for everyone, including the owner', () => {
    expect(Visibility.hidden()).toBe('count');
  });

  it('ownerOnly reveals to the owner and counts for everyone else', () => {
    expect(Visibility.ownerOnly(p1, p1)).toBe('full');
    expect(Visibility.ownerOnly(opponent, p1)).toBe('count');
    expect(Visibility.ownerOnly(null, p1)).toBe('count');
  });

  it('teamOnly reveals to a partner but not an opponent', () => {
    expect(Visibility.teamOnly(partner, p1)).toBe('full');
    expect(Visibility.teamOnly(opponent, p1)).toBe('count');
    expect(Visibility.teamOnly(null, p1)).toBe('count');
  });

  it('othersOnly hides a zone from its owner and shows it to everyone else', () => {
    // Hanabi: the case a fixed enum of visibility values cannot express.
    expect(Visibility.othersOnly(p1, p1)).toBe('count');
    expect(Visibility.othersOnly(opponent, p1)).toBe('full');
  });
});
