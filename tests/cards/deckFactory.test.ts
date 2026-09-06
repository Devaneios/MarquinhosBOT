import { describe, expect, it } from 'bun:test';
import {
  customDeck,
  spanishSuitedDeck,
  standardFrenchDeck,
} from 'services/activity/cards/core/deckFactory';

describe('standardFrenchDeck', () => {
  it('builds 52 unique cards across 4 suits by default', () => {
    const cards = standardFrenchDeck();
    expect(cards).toHaveLength(52);
    expect(new Set(cards.map((c) => c.id)).size).toBe(52);
    expect(new Set(cards.map((c) => c.suit))).toEqual(
      new Set(['♠', '♥', '♦', '♣']),
    );
  });

  it('adds the requested number of jokers, distinguishable from each other', () => {
    // Two jokers differing only by id collapse under any suit/rank-keyed
    // lookup, and games that use both need to tell them apart.
    const cards = standardFrenchDeck({ jokers: 2 });
    expect(cards).toHaveLength(54);
    const jokers = cards.filter((c) => c.rank === 'JOKER');
    expect(jokers).toHaveLength(2);
    expect(new Set(jokers.map((j) => j.suit)).size).toBe(2);
  });

  it('builds a multi-deck shoe with ids still unique across copies', () => {
    const shoe = standardFrenchDeck({ decks: 6 });
    expect(shoe).toHaveLength(312);
    expect(new Set(shoe.map((c) => c.id)).size).toBe(312);
    // Same physical card, six copies, six distinct identities.
    expect(shoe.filter((c) => c.suit === '♠' && c.rank === 'A')).toHaveLength(
      6,
    );
  });
});

describe('spanishSuitedDeck', () => {
  it('builds the 40-card truco deck (no 8/9/10 at all)', () => {
    const cards = spanishSuitedDeck();
    expect(cards).toHaveLength(40);
    for (const rank of ['8', '9', '10']) {
      expect(cards.some((c) => c.rank === rank)).toBe(false);
    }
  });

  it('supports regional variants that drop further ranks', () => {
    const cards = spanishSuitedDeck({ extraRemovedRanks: ['2', '3'] });
    expect(cards).toHaveLength(32);
    expect(cards.some((c) => c.rank === '2')).toBe(false);
    expect(cards.some((c) => c.rank === 'A')).toBe(true);
  });
});

describe('deterministic card ids', () => {
  it('gives the same card the same id on every build', () => {
    // The precondition for SeededRng's entire purpose: replaying a seeded
    // shuffle has to reproduce card *identity*, not just order, or no logged
    // reference to a card survives the replay.
    expect(standardFrenchDeck().map((c) => c.id)).toEqual(
      standardFrenchDeck().map((c) => c.id),
    );
    expect(spanishSuitedDeck().map((c) => c.id)).toEqual(
      spanishSuitedDeck().map((c) => c.id),
    );
  });

  it('encodes suit and rank in the id, so a card is readable in a log', () => {
    const ace = spanishSuitedDeck().find(
      (c) => c.suit === 'espadas' && c.rank === 'A',
    );
    expect(ace?.id).toBe('espadas-A-0');
  });
});

describe('customDeck', () => {
  it('assigns unique deterministic ids to homebrew cards', () => {
    const build = () =>
      customDeck([
        { props: { name: 'Fireball', cost: 3 } },
        { props: { name: 'Shield', cost: 1 } },
      ]);
    const cards = build();
    expect(cards).toHaveLength(2);
    expect(new Set(cards.map((c) => c.id)).size).toBe(2);
    expect(cards[0]!.props?.name).toBe('Fireball');
    expect(build().map((c) => c.id)).toEqual(cards.map((c) => c.id));
  });

  it('supports multiple copies of a homebrew deck', () => {
    const cards = customDeck([{ rank: 'X' }], { decks: 3 });
    expect(cards).toHaveLength(3);
    expect(new Set(cards.map((c) => c.id)).size).toBe(3);
  });

  it('preserves a caller-supplied props type without casting', () => {
    interface SpellProps {
      name: string;
      manaCost: number;
    }
    const cards = customDeck<SpellProps>([
      { props: { name: 'Fireball', manaCost: 3 } },
    ]);
    // No cast needed: props is typed as SpellProps, not Record<string, unknown>.
    const manaCost: number = cards[0]!.props!.manaCost;
    expect(manaCost).toBe(3);
  });
});
