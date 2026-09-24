import { describe, expect, it } from 'bun:test';
import { calculateTotal, determineWinner } from './blackjack';
import { calculatePayout } from './slots';

describe('casino rules', () => {
  it('treats an ace as one when eleven would bust', () => {
    expect(
      calculateTotal([
        { suit: '♠️', value: 'A', numericValue: 11 },
        { suit: '♣️', value: 'K', numericValue: 10 },
        { suit: '♥️', value: '5', numericValue: 5 },
      ]),
    ).toBe(16);
  });

  it('awards blackjack wins, losses, and pushes', () => {
    expect(determineWinner(18, 22)).toBe('win');
    expect(determineWinner(18, 19)).toBe('lose');
    expect(determineWinner(18, 18)).toBe('push');
  });

  it('pays exact and two-symbol slot matches', () => {
    expect(calculatePayout(['💎', '💎', '💎']).multiplier).toBe(100);
    expect(calculatePayout(['🍋', '🍋', '⭐']).multiplier).toBe(2);
    expect(calculatePayout(['🍋', '🍊', '⭐']).multiplier).toBe(0);
  });
});
