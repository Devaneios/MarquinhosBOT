import type { LetterFeedback } from '@marquinhos/contracts/wordle';
import { computeFeedback } from '@marquinhos/domain/games/wordle/feedback';
import { stripDiacritics } from '@marquinhos/domain/shared/text/stripDiacritics';

export interface PlayerState {
  userId: string;
  solved: boolean;
  exhausted: boolean;
  guesses: { guess: string; feedback: LetterFeedback[] }[];
  attempts: number;
}

export interface WordleRaceEngineState {
  targetWord: string;
  players: Map<string, PlayerState>;
  firstSolver: string | null;
  startedAt: number;
}

const MAX_ATTEMPTS = 6;

export class WordleRaceEngine {
  private state: WordleRaceEngineState;

  constructor(
    targetWord: string,
    private readonly resolveCanonical: (guess: string) => string | null,
    startedAt: number = Date.now(),
  ) {
    this.state = {
      targetWord: targetWord.toLowerCase(),
      players: new Map(),
      firstSolver: null,
      startedAt,
    };
  }

  getState(): Readonly<WordleRaceEngineState> {
    return {
      targetWord: this.state.targetWord,
      players: new Map(this.state.players),
      firstSolver: this.state.firstSolver,
      startedAt: this.state.startedAt,
    };
  }

  getTargetWord(): string {
    return this.state.targetWord;
  }

  addPlayer(userId: string): void {
    if (!this.state.players.has(userId)) {
      this.state.players.set(userId, {
        userId,
        solved: false,
        exhausted: false,
        guesses: [],
        attempts: 0,
      });
    }
  }

  removePlayer(userId: string): void {
    this.state.players.delete(userId);
  }

  hasPlayer(userId: string): boolean {
    return this.state.players.has(userId);
  }

  submitGuess(
    userId: string,
    guess: string,
  ): { feedback: LetterFeedback[]; solved: boolean } | { error: string } {
    const player = this.state.players.get(userId);
    if (!player) {
      return { error: 'Player not in room' };
    }

    if (player.solved) {
      return { error: 'Already solved' };
    }

    if (player.exhausted) {
      return { error: 'No attempts remaining' };
    }

    const normalizedTarget = stripDiacritics(
      this.state.targetWord,
    ).toLowerCase();
    const normalizedGuess = stripDiacritics(guess.trim()).toLowerCase();
    if (normalizedGuess.length !== normalizedTarget.length) {
      return {
        error: `Word must be ${normalizedTarget.length} letters long`,
      };
    }

    const canonicalGuess = this.resolveCanonical(guess);
    if (!canonicalGuess) {
      return { error: 'Invalid word' };
    }

    const normalizedCanonical = stripDiacritics(canonicalGuess).toLowerCase();
    if (
      player.guesses.some(
        (g) => stripDiacritics(g.guess).toLowerCase() === normalizedCanonical,
      )
    ) {
      return { error: 'Already guessed this word' };
    }

    const feedback = computeFeedback(normalizedCanonical, normalizedTarget);
    const solved = normalizedCanonical === normalizedTarget;

    player.guesses.push({ guess: canonicalGuess, feedback });
    player.attempts += 1;

    if (solved) {
      player.solved = true;
      if (!this.state.firstSolver) {
        this.state.firstSolver = userId;
      }
    }

    if (player.attempts >= MAX_ATTEMPTS) {
      player.exhausted = true;
    }

    return { feedback, solved };
  }

  isGameOver(): boolean {
    if (this.state.players.size === 0) return false;
    return Array.from(this.state.players.values()).every(
      (p) => p.solved || p.exhausted,
    );
  }

  getMaxAttempts(): number {
    return MAX_ATTEMPTS;
  }
}
