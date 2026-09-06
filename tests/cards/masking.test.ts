import { describe, expect, it } from 'bun:test';
import type { Card } from 'services/activity/cards/core/card';
import { isHidden, maskZones } from 'services/activity/cards/core/masking';
import type { Seat } from 'services/activity/cards/core/seating';
import { Visibility } from 'services/activity/cards/core/zone';
import { ZoneSet } from 'services/activity/cards/core/zoneSet';

// maskZones is the engine's only security boundary, so it gets a truth table
// rather than a couple of happy-path cases: every visibility level crossed with
// every viewer relationship, plus the per-card overrides.
const SEATS: Seat[] = [
  { seatIndex: 0, playerId: 'p1', teamId: 'A' },
  { seatIndex: 1, playerId: 'p2', teamId: 'B' },
  { seatIndex: 2, playerId: 'p3', teamId: 'A' },
];

function cards(...ids: string[]): Card[] {
  return ids.map((id) => ({ id }));
}

function visibleIds(
  zones: ZoneSet,
  viewer: string | null,
  zoneId: string,
): string[] {
  const view = maskZones(zones, viewer, SEATS)[zoneId]!;
  return view.cards.filter((c) => !isHidden(c)).map((c) => (c as Card).id);
}

describe('maskZones', () => {
  it('reveals a public zone to players and spectators alike', () => {
    const zones = new ZoneSet();
    zones.create(
      { id: 'table', owner: 'shared', visibility: Visibility.public },
      cards('a', 'b'),
    );
    expect(visibleIds(zones, 'p1', 'table')).toEqual(['a', 'b']);
    expect(visibleIds(zones, null, 'table')).toEqual(['a', 'b']);
  });

  it('hides a hidden zone from everyone while still reporting its size', () => {
    const zones = new ZoneSet();
    zones.create(
      { id: 'stock', owner: 'shared', visibility: Visibility.hidden },
      cards('a', 'b', 'c'),
    );
    const view = maskZones(zones, 'p1', SEATS).stock!;
    expect(view.count).toBe(3);
    expect(view.cards.every(isHidden)).toBe(true);
  });

  it('reveals an owner-only zone to its owner only', () => {
    const zones = new ZoneSet();
    zones.create(
      { id: 'hand_0', owner: 'p1', visibility: Visibility.ownerOnly },
      cards('a', 'b'),
    );
    expect(visibleIds(zones, 'p1', 'hand_0')).toEqual(['a', 'b']);
    expect(visibleIds(zones, 'p2', 'hand_0')).toEqual([]);
    expect(visibleIds(zones, 'p3', 'hand_0')).toEqual([]);
    // A spectator is the most important negative case: no seat, so no claim to
    // anyone's cards.
    expect(visibleIds(zones, null, 'hand_0')).toEqual([]);
  });

  it('never leaks a hidden card through the count-only representation', () => {
    const zones = new ZoneSet();
    zones.create(
      { id: 'hand_0', owner: 'p1', visibility: Visibility.ownerOnly },
      [{ id: 'secret', suit: 'espadas', rank: 'A' }],
    );
    const serialized = JSON.stringify(maskZones(zones, 'p2', SEATS));
    expect(serialized).not.toContain('secret');
    expect(serialized).not.toContain('espadas');
  });

  it('preserves position, so hidden cards keep their place in the pile', () => {
    const zones = new ZoneSet();
    zones.create(
      { id: 'discard', owner: 'shared', visibility: Visibility.topOnly },
      cards('bottom', 'middle', 'top'),
    );
    const view = maskZones(zones, 'p1', SEATS).discard!;
    expect(view.cards).toHaveLength(3);
    expect(isHidden(view.cards[0]!)).toBe(true);
    expect(isHidden(view.cards[1]!)).toBe(true);
    expect((view.cards[2] as Card).id).toBe('top');
  });

  it('reveals a team-only zone to a partner but not to an opponent', () => {
    const zones = new ZoneSet();
    zones.create(
      { id: 'dummy', owner: 'p1', visibility: Visibility.teamOnly },
      cards('a'),
    );
    expect(visibleIds(zones, 'p3', 'dummy')).toEqual(['a']); // same team
    expect(visibleIds(zones, 'p2', 'dummy')).toEqual([]); // other team
  });

  it('faceUp: true overrides a hidden zone (blackjack up-card in a hidden pile)', () => {
    const zones = new ZoneSet();
    zones.create(
      { id: 'dealer', owner: 'shared', visibility: Visibility.hidden },
      [{ id: 'up', faceUp: true }, { id: 'hole' }],
    );
    expect(visibleIds(zones, 'p1', 'dealer')).toEqual(['up']);
  });

  it('faceUp: false overrides a public zone (face-down card on an open board)', () => {
    const zones = new ZoneSet();
    zones.create(
      { id: 'board', owner: 'shared', visibility: Visibility.public },
      [{ id: 'open' }, { id: 'facedown', faceUp: false }],
    );
    expect(visibleIds(zones, 'p1', 'board')).toEqual(['open']);
  });

  it('faceUp: false hides a card even from the zone owner', () => {
    const zones = new ZoneSet();
    zones.create(
      { id: 'hand_0', owner: 'p1', visibility: Visibility.ownerOnly },
      [{ id: 'known' }, { id: 'blind', faceUp: false }],
    );
    expect(visibleIds(zones, 'p1', 'hand_0')).toEqual(['known']);
  });

  it('masks every zone on the table in one pass', () => {
    const zones = new ZoneSet();
    zones.create({ id: 'a', owner: 'shared', visibility: Visibility.public });
    zones.create({ id: 'b', owner: 'p1', visibility: Visibility.ownerOnly });
    expect(Object.keys(maskZones(zones, 'p1', SEATS)).sort()).toEqual([
      'a',
      'b',
    ]);
  });

  it('treats an unseated owner as nobody, rather than defaulting to visible', () => {
    // A zone whose owner has left the table must not become public.
    const zones = new ZoneSet();
    zones.create(
      { id: 'orphan', owner: 'ghost', visibility: Visibility.ownerOnly },
      cards('a'),
    );
    expect(visibleIds(zones, 'p1', 'orphan')).toEqual([]);
    expect(visibleIds(zones, null, 'orphan')).toEqual([]);
  });
});
