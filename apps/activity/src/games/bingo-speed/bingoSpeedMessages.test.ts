import type { BingoCard } from '@marquinhos/contracts/activity/games/bingoSpeed';
import { describe, expect, it } from 'bun:test';
import {
  applyBingoSpeedMessage,
  initialBingoSpeedView,
} from './bingoSpeedMessages';

const card: BingoCard = {
  board: Array.from({ length: 5 }, (_, row) =>
    Array.from({ length: 5 }, (_, col) => row * 5 + col + 1),
  ),
  marked: Array.from({ length: 5 }, () => Array(5).fill(false)),
};

describe('applyBingoSpeedMessage', () => {
  it('loads the card and the numbers drawn so far on init', () => {
    const view = applyBingoSpeedMessage(initialBingoSpeedView, {
      type: 'init',
      payload: {
        card,
        state: {
          playerCount: 2,
          drawnNumbers: [3, 7],
          gameStarted: true,
          winner: null,
        },
      },
    });

    expect(view.card).toEqual(card);
    expect([...view.drawnNumbers]).toEqual([3, 7]);
    expect(view.cardLoaded).toBe(true);
  });

  it('adds a drawn number without mutating the previous set', () => {
    const before = applyBingoSpeedMessage(initialBingoSpeedView, {
      type: 'number_drawn',
      payload: { number: 12 },
    });
    const after = applyBingoSpeedMessage(before, {
      type: 'number_drawn',
      payload: { number: 40 },
    });

    expect([...before.drawnNumbers]).toEqual([12]);
    expect([...after.drawnNumbers]).toEqual([12, 40]);
  });

  it('records the winner on game_end', () => {
    const view = applyBingoSpeedMessage(initialBingoSpeedView, {
      type: 'game_end',
      payload: { winner: 'rival' },
    });

    expect(view.winner).toBe('rival');
  });

  it('leaves the view unchanged for claim results', () => {
    expect(
      applyBingoSpeedMessage(initialBingoSpeedView, {
        type: 'bingo_claim_result',
        payload: { error: 'not yet' },
      }),
    ).toBe(initialBingoSpeedView);
  });
});
