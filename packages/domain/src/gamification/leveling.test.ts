import { describe, expect, it } from 'bun:test';
import { requiredXpForLevel } from './leveling';

describe('requiredXpForLevel', () => {
  it('uses the existing quadratic XP curve', () => {
    expect(requiredXpForLevel(1)).toBe(100);
    expect(requiredXpForLevel(2)).toBe(400);
    expect(requiredXpForLevel(10)).toBe(10_000);
  });
});
