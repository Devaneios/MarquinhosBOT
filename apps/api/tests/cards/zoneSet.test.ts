import { describe, expect, it } from 'bun:test';
import { Visibility } from 'services/activity/cards/core/zone';
import { ZoneSet } from 'services/activity/cards/core/zoneSet';

const hand = { id: 'hand', owner: 'p1', visibility: Visibility.ownerOnly };
const discard = {
  id: 'discard',
  owner: 'shared' as const,
  visibility: Visibility.public,
};

describe('ZoneSet', () => {
  it('creates and retrieves zones by id', () => {
    const zones = new ZoneSet();
    zones.create(hand);
    expect(zones.get('hand')?.config.owner).toBe('p1');
  });

  it('returns undefined for an unknown zone id', () => {
    const zones = new ZoneSet();
    expect(zones.get('missing')).toBeUndefined();
    expect(zones.has('missing')).toBe(false);
  });

  it('require() throws with a useful message instead of returning undefined', () => {
    // A ruleset asking for a zone it declared itself is not a case worth
    // handling — it's a bug, and it should say so rather than push a `!` onto
    // every call site.
    const zones = new ZoneSet();
    zones.create(hand);
    expect(zones.require('hand').config.id).toBe('hand');
    expect(() => zones.require('nope')).toThrow(/does not exist/);
    expect(() => zones.require('nope')).toThrow(/hand/); // lists what does exist
  });

  it('lists all created zones', () => {
    const zones = new ZoneSet();
    zones.create(hand);
    zones.create(discard);
    expect(zones.ids().sort()).toEqual(['discard', 'hand']);
    expect(zones.all()).toHaveLength(2);
  });

  it('zonesOf() groups zones by owner, which is what masking iterates', () => {
    const zones = new ZoneSet();
    zones.create(hand);
    zones.create({ ...hand, id: 'tricks_p1' });
    zones.create(discard);
    expect(
      zones
        .zonesOf('p1')
        .map((z) => z.config.id)
        .sort(),
    ).toEqual(['hand', 'tricks_p1']);
    expect(zones.zonesOf('shared').map((z) => z.config.id)).toEqual([
      'discard',
    ]);
  });

  it('seeds a created zone with initial cards', () => {
    const zones = new ZoneSet();
    zones.create(
      { id: 'stock', owner: 'shared', visibility: Visibility.hidden },
      [{ id: 'card-1' }],
    );
    expect(zones.get('stock')?.cards).toHaveLength(1);
  });

  it('clone() is deep, so a cloned set cannot mutate the original zones', () => {
    // The whole reason a ZoneSet can live inside an immutable ruleset state: a
    // shallow copy would alias every Zone and silently rewrite history.
    const zones = new ZoneSet();
    zones.create(hand, [{ id: 'a' }, { id: 'b' }]);

    const next = zones.clone();
    next.require('hand').remove(['a']);

    expect(next.require('hand').cards.map((c) => c.id)).toEqual(['b']);
    expect(zones.require('hand').cards.map((c) => c.id)).toEqual(['a', 'b']);
  });

  it('clone() carries every zone across, not just the mutated one', () => {
    const zones = new ZoneSet();
    zones.create(hand, [{ id: 'a' }]);
    zones.create(discard, [{ id: 'd' }]);
    const next = zones.clone();
    expect(next.ids().sort()).toEqual(['discard', 'hand']);
    expect(next.require('discard').cards.map((c) => c.id)).toEqual(['d']);
  });

  it('preserves a caller-supplied props type without casting', () => {
    interface SpellProps {
      manaCost: number;
    }
    const zones = new ZoneSet<SpellProps>();
    zones.create(hand, [{ id: 'a', props: { manaCost: 3 } }]);
    // No cast needed: props is typed as SpellProps, not Record<string, unknown>.
    const manaCost: number = zones.require('hand').cards[0]!.props!.manaCost;
    expect(manaCost).toBe(3);
  });
});
