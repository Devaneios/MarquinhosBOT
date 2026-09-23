import { describe, expect, it } from 'bun:test';
import { checkBet, sumPayout } from './dice';

describe('dice betting rules', () => {
  it('awards sum bets with more payout at the edge of the range', () => {
    expect(sumPayout(2, 2)).toBe(10);
    expect(checkBet({ betType: 'sum', betValue: 2, diceCount: 2 }, [1, 1])).toEqual({
      isWin: true,
      payout: 10,
    });
  });

  it('counts exact matches and resolves parity bets', () => {
    expect(checkBet({ betType: 'exact', betValue: 3, diceCount: 3 }, [3, 3, 1])).toEqual({
      isWin: true,
      payout: 4,
    });
    expect(checkBet({ betType: 'even_odd', betValue: 'odd', diceCount: 2 }, [1, 2])).toEqual({
      isWin: true,
      payout: 2,
    });
  });
});
