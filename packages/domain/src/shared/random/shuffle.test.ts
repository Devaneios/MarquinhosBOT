import { describe, expect, it } from 'bun:test';
import { shuffle } from './shuffle';

describe('shuffle', () => {
  it('returns a permutation without touching the input', () => {
    const items = [1, 2, 3, 4, 5];
    const result = shuffle(items);

    expect([...result].sort()).toEqual([1, 2, 3, 4, 5]);
    expect(items).toEqual([1, 2, 3, 4, 5]);
  });

  it('draws every swap from the given random source', () => {
    expect(shuffle(['a', 'b', 'c', 'd'], () => 0)).toEqual([
      'b',
      'c',
      'd',
      'a',
    ]);
  });

  it('reaches every ordering of three items with equal frequency', () => {
    const counts = new Map<string, number>();
    let seed = 1;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    for (let i = 0; i < 60_000; i++) {
      const key = shuffle(['a', 'b', 'c'], random).join('');
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    expect(counts.size).toBe(6);
    for (const count of counts.values()) {
      expect(Math.abs(count - 10_000)).toBeLessThan(500);
    }
  });
});
