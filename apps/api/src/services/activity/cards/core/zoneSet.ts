import type { Card } from 'services/activity/cards/core/card';
import { Zone, type ZoneConfig } from 'services/activity/cards/core/zone';

// Named registry of every zone on one table (hand_p1, hand_p2, discard, stock,
// trickPile_p1, ...). A GameDefinition.setup() declares exactly the zones its
// ruleset needs — the core engine never hardcodes zone names.
//
// TProps threads through to every Zone<TProps> it creates: all zones on one
// table share the same card-props shape, since a table is always one game.
export class ZoneSet<TProps = Record<string, unknown>> {
  private zones = new Map<string, Zone<TProps>>();

  // Deep clone: the zones are cloned too, not just the map. This is what lets a
  // ruleset hold a ZoneSet in its state and still honour GameDefinition.apply's
  // immutable contract — `state.zones.clone()` yields a set that can be mutated
  // freely without touching the previous state. A shallow copy would alias
  // every Zone and silently rewrite history.
  clone(): ZoneSet<TProps> {
    const copy = new ZoneSet<TProps>();
    for (const [id, zone] of this.zones) copy.zones.set(id, zone.clone());
    return copy;
  }

  create(
    config: ZoneConfig,
    cards: readonly Card<TProps>[] = [],
  ): Zone<TProps> {
    const zone = new Zone<TProps>(config, cards);
    this.zones.set(config.id, zone);
    return zone;
  }

  get(zoneId: string): Zone<TProps> | undefined {
    return this.zones.get(zoneId);
  }

  // For the overwhelmingly common case: a ruleset asking for a zone it declared
  // in its own setup(). `undefined` there is not a case worth handling — it's a
  // ruleset bug — so this throws instead of pushing a `!` onto every call site.
  require(zoneId: string): Zone<TProps> {
    const zone = this.zones.get(zoneId);
    if (!zone) {
      throw new Error(
        `Zone "${zoneId}" does not exist on this table (declared: ${this.ids().join(', ')})`,
      );
    }
    return zone;
  }

  has(zoneId: string): boolean {
    return this.zones.has(zoneId);
  }

  ids(): string[] {
    return [...this.zones.keys()];
  }

  all(): Zone<TProps>[] {
    return [...this.zones.values()];
  }

  // The access pattern masking and "show me my hands" both need: every zone
  // belonging to one player, or every table-wide zone when passed 'shared'.
  zonesOf(owner: 'shared' | string): Zone<TProps>[] {
    return this.all().filter((zone) => zone.config.owner === owner);
  }
}
