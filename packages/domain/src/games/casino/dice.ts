export type DiceBet =
  | { betType: 'sum'; betValue: number }
  | { betType: 'exact'; betValue: number }
  | { betType: 'even_odd'; betValue: 'even' | 'odd' }
  | { betType: 'high_low'; betValue: 'high' | 'low' }
  | { betType: null; betValue: null };

export function sumPayout(diceCount: number, targetSum: number): number {
  const minSum = diceCount;
  const maxSum = diceCount * 6;
  const midPoint = (minSum + maxSum) / 2;
  const distance = Math.abs(targetSum - midPoint);
  const maxDistance = midPoint - minSum;
  const difficulty = distance / maxDistance;
  return Math.floor(2 + difficulty * 8);
}

export function checkBet(
  bet: DiceBet & { diceCount: number },
  roll: number[],
): { isWin: boolean; payout: number } {
  const sum = roll.reduce((a, b) => a + b, 0);
  switch (bet.betType) {
    case 'sum':
      return {
        isWin: sum === bet.betValue,
        payout: sumPayout(bet.diceCount, bet.betValue),
      };
    case 'exact': {
      const count = roll.filter((die) => die === bet.betValue).length;
      return { isWin: count > 0, payout: count * 2 };
    }
    case 'even_odd':
      return {
        isWin: (sum % 2 === 0) === (bet.betValue === 'even'),
        payout: 2,
      };
    case 'high_low':
      return {
        isWin: sum > (bet.diceCount * 6) / 2 === (bet.betValue === 'high'),
        payout: 2,
      };
    default:
      return { isWin: false, payout: 0 };
  }
}
