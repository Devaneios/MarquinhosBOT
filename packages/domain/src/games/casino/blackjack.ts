export interface Card {
  suit: string;
  value: string;
  numericValue: number;
}

export function calculateTotal(cards: Card[]): number {
  let total = 0;
  let aces = 0;

  for (const card of cards) {
    if (card.value === 'A') {
      aces++;
      total += 11;
    } else {
      total += card.numericValue;
    }
  }

  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }

  return total;
}

export function determineWinner(
  playerTotal: number,
  dealerTotal: number,
): 'win' | 'lose' | 'push' {
  if (dealerTotal > 21 || playerTotal > dealerTotal) return 'win';
  if (playerTotal < dealerTotal) return 'lose';
  return 'push';
}
