export interface BingoCard {
  board: number[][];
  marked: boolean[][];
}

export interface BingoSpeedEngineState {
  drawnNumbers: number[];
  numbersDrawn: number;
}

export class BingoSpeedEngine {
  private drawnNumbers: Set<number> = new Set();
  private allDrawn: number[] = [];

  generateCard(): BingoCard {
    const board: number[][] = [];

    for (let row = 0; row < 5; row++) {
      board[row] = [];
      for (let col = 0; col < 5; col++) {
        if (row === 2 && col === 2) {
          board[row]![col] = 0;
          continue;
        }

        let num = this.generateNumberForColumn(col);
        while (
          board[row]!.slice(0, col).includes(num) ||
          board.slice(0, row).some((r) => r[col] === num)
        ) {
          num = this.generateNumberForColumn(col);
        }

        board[row]![col] = num;
      }
    }

    const marked: boolean[][] = [];
    for (let row = 0; row < 5; row++) {
      marked[row] = [];
      for (let col = 0; col < 5; col++) {
        marked[row]![col] = row === 2 && col === 2;
      }
    }

    return { board, marked };
  }

  private generateNumberForColumn(col: number): number {
    const ranges: [number, number][] = [
      [1, 15],
      [16, 30],
      [31, 45],
      [46, 60],
      [61, 75],
    ];
    const [min, max] = ranges[col]!;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  drawNumber(): number | null {
    if (this.drawnNumbers.size === 75) {
      return null;
    }

    let num = Math.floor(Math.random() * 75) + 1;
    while (this.drawnNumbers.has(num)) {
      num = Math.floor(Math.random() * 75) + 1;
    }

    this.drawnNumbers.add(num);
    this.allDrawn.push(num);
    return num;
  }

  markNumber(card: BingoCard, number: number): void {
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 5; col++) {
        if (card.board[row]![col] === number) {
          card.marked[row]![col] = true;
          return;
        }
      }
    }
  }

  checkBingo(card: BingoCard): boolean {
    // Check rows
    for (let row = 0; row < 5; row++) {
      if (card.marked[row]!.every((m) => m)) {
        return true;
      }
    }

    // Check columns
    for (let col = 0; col < 5; col++) {
      if (card.marked.every((row) => row[col])) {
        return true;
      }
    }

    // Check diagonals
    let topLeftDiag = true;
    for (let i = 0; i < 5; i++) {
      if (!card.marked[i]![i]) {
        topLeftDiag = false;
        break;
      }
    }

    let topRightDiag = true;
    for (let i = 0; i < 5; i++) {
      if (!card.marked[i]![4 - i]) {
        topRightDiag = false;
        break;
      }
    }

    return topLeftDiag || topRightDiag;
  }

  verifyBingoClaim(card: BingoCard, rowOrColOrDiag: number): boolean {
    // Verify that all numbers in the claimed line were actually drawn
    // This is a placeholder - would verify the specific line based on type
    void rowOrColOrDiag;

    // Check rows
    for (let row = 0; row < 5; row++) {
      if (card.marked[row]!.every((m) => m)) {
        for (let col = 0; col < 5; col++) {
          const num = card.board[row]![col];
          if (num !== 0 && !this.drawnNumbers.has(num!)) {
            return false;
          }
        }
        return true;
      }
    }

    // Check columns
    for (let col = 0; col < 5; col++) {
      if (card.marked.every((row) => row[col])) {
        for (let row = 0; row < 5; row++) {
          const num = card.board[row]![col];
          if (num !== 0 && !this.drawnNumbers.has(num!)) {
            return false;
          }
        }
        return true;
      }
    }

    // Check diagonals
    let topLeftDiag = true;
    for (let i = 0; i < 5; i++) {
      if (!card.marked[i]![i]) {
        topLeftDiag = false;
        break;
      }
    }

    if (topLeftDiag) {
      for (let i = 0; i < 5; i++) {
        const num = card.board[i]![i];
        if (num !== 0 && !this.drawnNumbers.has(num!)) {
          return false;
        }
      }
      return true;
    }

    let topRightDiag = true;
    for (let i = 0; i < 5; i++) {
      if (!card.marked[i]![4 - i]) {
        topRightDiag = false;
        break;
      }
    }

    if (topRightDiag) {
      for (let i = 0; i < 5; i++) {
        const num = card.board[i]![4 - i];
        if (num !== 0 && !this.drawnNumbers.has(num!)) {
          return false;
        }
      }
      return true;
    }

    return false;
  }

  createTestCard(board: number[][]): BingoCard {
    const marked: boolean[][] = [];
    for (let row = 0; row < 5; row++) {
      marked[row] = [];
      for (let col = 0; col < 5; col++) {
        marked[row]![col] = row === 2 && col === 2;
      }
    }
    return { board, marked };
  }

  setDrawnNumbersForTesting(numbers: number[]): void {
    this.drawnNumbers.clear();
    this.allDrawn = [];
    for (const num of numbers) {
      this.drawnNumbers.add(num);
      this.allDrawn.push(num);
    }
  }

  getState(): BingoSpeedEngineState {
    return {
      drawnNumbers: Array.from(this.drawnNumbers).sort((a, b) => a - b),
      numbersDrawn: this.drawnNumbers.size,
    };
  }
}
