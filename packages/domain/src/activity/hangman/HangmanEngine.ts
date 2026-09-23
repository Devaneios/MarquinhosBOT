export interface HangmanState {
  word: string;
  guessedLetters: Set<string>;
  strikes: number;
  maxStrikes: number;
  gameOver: boolean;
  won: boolean;
}

export class HangmanEngine {
  private originalWord: string;
  private readonly wordLower: string;
  private guessedLetters: Set<string> = new Set();
  private strikes: number = 0;
  private maxStrikes: number = 6;
  private gameOver: boolean = false;
  private won: boolean = false;

  constructor(word: string) {
    this.originalWord = word;
    this.wordLower = word.toLowerCase();
  }

  guessLetter(letter: string): boolean {
    const normalizedLetter = letter.toLowerCase();

    if (this.gameOver || this.guessedLetters.has(normalizedLetter)) {
      return false;
    }

    this.guessedLetters.add(normalizedLetter);

    if (!this.wordLower.includes(normalizedLetter)) {
      this.strikes += 1;
      if (this.strikes >= this.maxStrikes) {
        this.gameOver = true;
      }
    } else {
      this.checkWinCondition();
    }

    return true;
  }

  private checkWinCondition(): void {
    const allLettersGuessed = Array.from(this.wordLower).every((letter) =>
      this.guessedLetters.has(letter),
    );

    if (allLettersGuessed) {
      this.won = true;
      this.gameOver = true;
    }
  }

  getRevealedWord(): string {
    return Array.from(this.originalWord)
      .map((letter) =>
        this.guessedLetters.has(letter.toLowerCase()) ? letter : '_',
      )
      .join('');
  }

  getState(): HangmanState {
    return {
      word: this.wordLower,
      guessedLetters: new Set(this.guessedLetters),
      strikes: this.strikes,
      maxStrikes: this.maxStrikes,
      gameOver: this.gameOver,
      won: this.won,
    };
  }
}
