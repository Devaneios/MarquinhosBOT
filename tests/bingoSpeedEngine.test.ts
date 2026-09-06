import { describe, expect, it } from 'bun:test';
import { BingoSpeedEngine } from 'services/activity/bingoSpeed/BingoSpeedEngine';

describe('BingoSpeedEngine', () => {
  describe('Card Generation', () => {
    it('generates a 5x5 card with numbers in proper B-I-N-G-O column ranges', () => {
      const engine = new BingoSpeedEngine();
      const card = engine.generateCard();

      expect(card.board.length).toBe(5);
      card.board.forEach((row, rowIdx) => {
        expect(row.length).toBe(5);
        row.forEach((num, colIdx) => {
          expect(typeof num).toBe('number');
          if (rowIdx === 2 && colIdx === 2) {
            expect(num).toBe(0); // Free space
          } else {
            expect(num).toBeGreaterThanOrEqual(1);
            expect(num).toBeLessThanOrEqual(75);
          }
        });
      });
    });

    it('B column contains numbers 1-15', () => {
      const engine = new BingoSpeedEngine();
      const card = engine.generateCard();

      card.board.forEach((row) => {
        const bNumber = row[0];
        expect(bNumber).toBeGreaterThanOrEqual(1);
        expect(bNumber).toBeLessThanOrEqual(15);
      });
    });

    it('I column contains numbers 16-30', () => {
      const engine = new BingoSpeedEngine();
      const card = engine.generateCard();

      card.board.forEach((row) => {
        const iNumber = row[1];
        expect(iNumber).toBeGreaterThanOrEqual(16);
        expect(iNumber).toBeLessThanOrEqual(30);
      });
    });

    it('N column contains numbers 31-45 (except free space at center)', () => {
      const engine = new BingoSpeedEngine();
      const card = engine.generateCard();

      card.board.forEach((row, rowIdx) => {
        const nNumber = row[2];
        if (rowIdx === 2) {
          // Center is free space
          expect(nNumber).toBe(0);
        } else {
          expect(nNumber).toBeGreaterThanOrEqual(31);
          expect(nNumber).toBeLessThanOrEqual(45);
        }
      });
    });

    it('G column contains numbers 46-60', () => {
      const engine = new BingoSpeedEngine();
      const card = engine.generateCard();

      card.board.forEach((row) => {
        const gNumber = row[3];
        expect(gNumber).toBeGreaterThanOrEqual(46);
        expect(gNumber).toBeLessThanOrEqual(60);
      });
    });

    it('O column contains numbers 61-75', () => {
      const engine = new BingoSpeedEngine();
      const card = engine.generateCard();

      card.board.forEach((row) => {
        const oNumber = row[4];
        expect(oNumber).toBeGreaterThanOrEqual(61);
        expect(oNumber).toBeLessThanOrEqual(75);
      });
    });

    it('has no duplicate numbers on the same card', () => {
      const engine = new BingoSpeedEngine();
      const card = engine.generateCard();

      const numbers = new Set<number>();
      card.board.forEach((row) => {
        row.forEach((num) => {
          if (num !== 0) {
            // Skip free space
            if (numbers.has(num)) {
              throw new Error(`Duplicate number: ${num}`);
            }
            numbers.add(num);
          }
        });
      });

      expect(numbers.size).toBe(24); // 25 - 1 free space
    });

    it('marks center square as free (0)', () => {
      const engine = new BingoSpeedEngine();
      const card = engine.generateCard();

      expect(card.board[2]![2]).toBe(0);
    });
  });

  describe('Drawing Numbers', () => {
    it('draws a random number between 1 and 75', () => {
      const engine = new BingoSpeedEngine();
      const number = engine.drawNumber();

      expect(number).toBeGreaterThanOrEqual(1);
      expect(number).toBeLessThanOrEqual(75);
    });

    it('never draws the same number twice', () => {
      const engine = new BingoSpeedEngine();
      const drawn = new Set<number>();

      for (let i = 0; i < 75; i++) {
        const number = engine.drawNumber();
        expect(number).not.toBeNull();
        expect(drawn.has(number!)).toBe(false);
        drawn.add(number!);
      }
    });

    it('returns null when all numbers have been drawn', () => {
      const engine = new BingoSpeedEngine();

      for (let i = 0; i < 75; i++) {
        engine.drawNumber();
      }

      const number = engine.drawNumber();
      expect(number).toBeNull();
    });

    it('tracks drawn numbers in state', () => {
      const engine = new BingoSpeedEngine();
      const number = engine.drawNumber();

      const state = engine.getState();
      expect(state.drawnNumbers).toContain(number!);
    });
  });

  describe('Marking Numbers', () => {
    it('marks a number as marked on a card', () => {
      const engine = new BingoSpeedEngine();
      const card = engine.generateCard();

      // Manually set a known number in the card
      card.board[0]![0] = 5; // B column
      card.marked[0]![0] = false;

      engine.markNumber(card, 5);

      expect(card.marked[0]![0]).toBe(true);
    });

    it('marks free space as always marked', () => {
      const engine = new BingoSpeedEngine();
      const card = engine.generateCard();

      expect(card.marked[2]![2]).toBe(true);
    });

    it('does not mark if number is not on card', () => {
      const engine = new BingoSpeedEngine();
      const card = engine.generateCard();

      const initialMarked = JSON.parse(JSON.stringify(card.marked));
      engine.markNumber(card, 1000);

      expect(card.marked).toEqual(initialMarked);
    });
  });

  describe('Bingo Detection', () => {
    it('detects a horizontal line bingo', () => {
      const engine = new BingoSpeedEngine();
      const card = engine.createTestCard([
        [1, 2, 3, 4, 5],
        [6, 7, 8, 9, 10],
        [11, 12, 0, 13, 14],
        [15, 16, 17, 18, 19],
        [20, 21, 22, 23, 24],
      ]);

      card.marked[0] = [true, true, true, true, true];

      expect(engine.checkBingo(card)).toBe(true);
    });

    it('detects a vertical line bingo', () => {
      const engine = new BingoSpeedEngine();
      const card = engine.createTestCard([
        [1, 2, 3, 4, 5],
        [6, 7, 8, 9, 10],
        [11, 12, 0, 13, 14],
        [15, 16, 17, 18, 19],
        [20, 21, 22, 23, 24],
      ]);

      for (let i = 0; i < 5; i++) {
        card.marked[i]![0] = true;
      }

      expect(engine.checkBingo(card)).toBe(true);
    });

    it('detects a diagonal bingo from top-left to bottom-right', () => {
      const engine = new BingoSpeedEngine();
      const card = engine.createTestCard([
        [1, 2, 3, 4, 5],
        [6, 7, 8, 9, 10],
        [11, 12, 0, 13, 14],
        [15, 16, 17, 18, 19],
        [20, 21, 22, 23, 24],
      ]);

      for (let i = 0; i < 5; i++) {
        card.marked[i]![i] = true;
      }

      expect(engine.checkBingo(card)).toBe(true);
    });

    it('detects a diagonal bingo from top-right to bottom-left', () => {
      const engine = new BingoSpeedEngine();
      const card = engine.createTestCard([
        [1, 2, 3, 4, 5],
        [6, 7, 8, 9, 10],
        [11, 12, 0, 13, 14],
        [15, 16, 17, 18, 19],
        [20, 21, 22, 23, 24],
      ]);

      for (let i = 0; i < 5; i++) {
        card.marked[i]![4 - i] = true;
      }

      expect(engine.checkBingo(card)).toBe(true);
    });

    it('returns false when no line is completed', () => {
      const engine = new BingoSpeedEngine();
      const card = engine.generateCard();

      expect(engine.checkBingo(card)).toBe(false);
    });

    it('verifies bingo claim against drawn numbers', () => {
      const engine = new BingoSpeedEngine();

      const card = engine.createTestCard([
        [1, 2, 3, 4, 5],
        [6, 7, 8, 9, 10],
        [11, 12, 0, 13, 14],
        [15, 16, 17, 18, 19],
        [20, 21, 22, 23, 24],
      ]);

      card.marked[0] = [true, true, true, true, true];

      // Should fail when numbers haven't been drawn
      expect(engine.verifyBingoClaim(card, 0)).toBe(false);

      // Set the numbers as drawn and verify should pass
      engine.setDrawnNumbersForTesting([1, 2, 3, 4, 5]);
      expect(engine.verifyBingoClaim(card, 0)).toBe(true);
    });
  });

  describe('Game State', () => {
    it('returns current game state', () => {
      const engine = new BingoSpeedEngine();
      const number = engine.drawNumber();

      const state = engine.getState();

      expect(state.drawnNumbers).toContain(number!);
      expect(state.numbersDrawn).toBe(1);
    });

    it('tracks total numbers drawn', () => {
      const engine = new BingoSpeedEngine();

      let state = engine.getState();
      expect(state.numbersDrawn).toBe(0);

      engine.drawNumber();
      state = engine.getState();
      expect(state.numbersDrawn).toBe(1);

      engine.drawNumber();
      state = engine.getState();
      expect(state.numbersDrawn).toBe(2);
    });
  });
});
