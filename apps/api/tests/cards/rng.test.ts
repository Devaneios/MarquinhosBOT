import { describe, expect, it } from 'bun:test';
import { SeededRng } from 'services/activity/cards/core/rng';

describe('SeededRng', () => {
  it('produces the same sequence for the same seed', () => {
    const a = new SeededRng(42);
    const b = new SeededRng(42);

    const seqA = [a.next(), a.next(), a.next()];
    const seqB = [b.next(), b.next(), b.next()];

    expect(seqA).toEqual(seqB);
  });

  it('produces different sequences for different seeds', () => {
    const a = new SeededRng(1);
    const b = new SeededRng(2);

    expect(a.next()).not.toBe(b.next());
  });

  it('next() stays within [0, 1)', () => {
    const rng = new SeededRng(7);
    for (let i = 0; i < 100; i++) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('shuffle is deterministic for the same seed and preserves all elements', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];

    const shuffledA = new SeededRng(99).shuffle(input);
    const shuffledB = new SeededRng(99).shuffle(input);

    expect(shuffledA).toEqual(shuffledB);
    expect([...shuffledA].sort()).toEqual([...input].sort());
    // shuffle must not mutate the input array
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('shuffle with different seeds yields different orderings', () => {
    const input = Array.from({ length: 20 }, (_, i) => i);
    const shuffledA = new SeededRng(1).shuffle(input);
    const shuffledB = new SeededRng(2).shuffle(input);

    expect(shuffledA).not.toEqual(shuffledB);
  });
});
