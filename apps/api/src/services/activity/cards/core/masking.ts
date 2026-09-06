import type { Card } from 'services/activity/cards/core/card';
import type { Seat } from 'services/activity/cards/core/seating';
import type { VisibilityLevel, Zone } from 'services/activity/cards/core/zone';
import type { ZoneSet } from 'services/activity/cards/core/zoneSet';

// A card the viewer may not see. Hidden cards keep their *position* in the
// zone — a masked view is the same length and order as the real zone — because
// position is public information and often load-bearing (which seat played
// where in a trick, where in a tableau a face-down card sits).
export interface HiddenCard {
  hidden: true;
}

export type MaskedCard<TProps = Record<string, unknown>> =
  Card<TProps> | HiddenCard;

export function isHidden<TProps>(card: MaskedCard<TProps>): card is HiddenCard {
  return (card as HiddenCard).hidden;
}

export interface ZoneView<TProps = Record<string, unknown>> {
  id: string;
  owner: 'shared' | string;
  count: number;
  cards: MaskedCard<TProps>[];
}

// THE masking function: turns declared zone visibility into what one specific
// viewer is allowed to receive.
//
// This is the engine's only security boundary, so it exists exactly once and is
// tested against a truth table rather than being re-derived inside every
// ruleset's maskStateFor(). A ruleset composes this with its own public fields;
// it should never hand-roll card hiding, because a bug there is a card leak and
// there is no way to test for the leak generically if each game does it
// differently.
//
// `viewerId` null is a spectator: no seat, so owner-only zones resolve to
// counts and nothing private is ever emitted.
export function maskZones<TProps>(
  zones: ZoneSet<TProps>,
  viewerId: string | null,
  seats: readonly Seat[],
): Record<string, ZoneView<TProps>> {
  const viewer = viewerId
    ? (seats.find((s) => s.playerId === viewerId) ?? null)
    : null;
  const views: Record<string, ZoneView<TProps>> = {};
  for (const zone of zones.all()) {
    views[zone.config.id] = maskZone(zone, viewer, seats);
  }
  return views;
}

export function maskZone<TProps>(
  zone: Zone<TProps>,
  viewer: Seat | null,
  seats: readonly Seat[],
): ZoneView<TProps> {
  const ownerId = zone.config.owner;
  const owner =
    ownerId === 'shared'
      ? null
      : (seats.find((s) => s.playerId === ownerId) ?? null);
  const level = zone.config.visibility(viewer, owner);
  const cards = zone.cards;
  const topIndex = cards.length - 1;

  return {
    id: zone.config.id,
    owner: ownerId,
    count: cards.length,
    cards: cards.map((card, index) =>
      revealCard(card, level, index === topIndex),
    ),
  };
}

// Per-card `faceUp` overrides the zone's level in both directions, which is the
// only way to express a pile of mixed face state: blackjack's hole card sits
// face-down in an otherwise public hand, a TCG's face-down creature sits on a
// public battlefield. Zone-level visibility alone cannot say either.
function revealCard<TProps>(
  card: Card<TProps>,
  level: VisibilityLevel,
  isTop: boolean,
): MaskedCard<TProps> {
  if (card.faceUp === true) return card;
  if (card.faceUp === false) return { hidden: true };
  switch (level) {
    case 'full':
      return card;
    case 'top':
      return isTop ? card : { hidden: true };
    case 'count':
      return { hidden: true };
  }
}
