const PAYOUTS: Record<string, number> = {
  '💎💎💎': 100,
  '7️⃣7️⃣7️⃣': 50,
  '⭐⭐⭐': 25,
  '🔔🔔🔔': 15,
  '🍇🍇🍇': 10,
  '🍊🍊🍊': 8,
  '🍋🍋🍋': 6,
  '🍒🍒🍒': 4,
  ANY_TWO: 2,
};

export function calculatePayout(result: string[]): {
  multiplier: number;
  winType: string;
} {
  const resultString = result.join('');

  for (const [combination, payout] of Object.entries(PAYOUTS)) {
    if (combination === resultString) {
      return { multiplier: payout, winType: combination };
    }
  }

  if (
    result[0] === result[1] ||
    result[1] === result[2] ||
    result[0] === result[2]
  ) {
    return { multiplier: PAYOUTS.ANY_TWO, winType: 'Dois iguais' };
  }

  return { multiplier: 0, winType: 'Sem prêmio' };
}
