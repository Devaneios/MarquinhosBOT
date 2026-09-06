import { readFileSync } from 'fs';
import { resolve } from 'path';

export interface WordChainState {
  gameOver: boolean;
  winner: string | null;
  currentTurn: string;
  currentWord: string;
  usedWords: Set<string>;
  players: { userId: string; alive: boolean }[];
}

export class WordChainEngine {
  private readonly wordlist: Set<string>;
  private readonly state: WordChainState;
  private turnOrder: string[] = [];
  private currentTurnIndex = 0;

  constructor(wordlistPath?: string) {
    const path = wordlistPath || resolve(process.cwd(), 'wordlist.txt');
    const content = readFileSync(path, 'utf-8');
    this.wordlist = new Set(
      content
        .split('\n')
        .map((w) => w.trim().toLowerCase())
        .filter(Boolean),
    );

    this.state = {
      gameOver: false,
      winner: null,
      currentTurn: '',
      currentWord: '',
      usedWords: new Set(),
      players: [],
    };
  }

  getState(): WordChainState {
    return {
      ...this.state,
      usedWords: new Set(this.state.usedWords),
      players: [...this.state.players],
    };
  }

  addPlayer(userId: string): void {
    if (this.state.players.some((p) => p.userId === userId)) return;
    this.state.players.push({ userId, alive: true });
    this.turnOrder.push(userId);
    if (this.state.currentTurn === '') {
      this.state.currentTurn = userId;
    }
  }

  removePlayer(userId: string): void {
    const player = this.state.players.find((p) => p.userId === userId);
    if (!player) return;
    player.alive = false;
    // Losing the current-turn player must hand the turn to the next living
    // player — otherwise `currentTurn` keeps pointing at someone who can
    // never submit again, and no one else can either (they're never "up").
    if (this.state.currentTurn === userId) {
      this.advanceTurn();
    }
    this.checkWinCondition();
  }

  submitWord(userId: string, word: string): { valid: boolean; error?: string } {
    if (this.state.gameOver) {
      return { valid: false, error: 'Game is over' };
    }

    if (userId !== this.state.currentTurn) {
      return { valid: false, error: 'Not your turn' };
    }

    const normalized = word.trim().toLowerCase();

    if (!this.wordlist.has(normalized)) {
      return { valid: false, error: 'Word not in dictionary' };
    }

    if (this.state.usedWords.has(normalized)) {
      return { valid: false, error: 'Word already used' };
    }

    if (
      this.state.currentWord &&
      !normalized.startsWith(
        this.state.currentWord[this.state.currentWord.length - 1]!,
      )
    ) {
      return {
        valid: false,
        error: `Word must start with "${this.state.currentWord[this.state.currentWord.length - 1]}"`,
      };
    }

    this.state.currentWord = normalized;
    this.state.usedWords.add(normalized);
    this.advanceTurn();
    return { valid: true };
  }

  private advanceTurn(): void {
    let attempts = 0;
    const maxAttempts = this.state.players.length;

    do {
      this.currentTurnIndex =
        (this.currentTurnIndex + 1) % this.turnOrder.length;
      const nextPlayer = this.turnOrder[this.currentTurnIndex]!;
      const playerData = this.state.players.find(
        (p) => p.userId === nextPlayer,
      );

      if (playerData?.alive) {
        this.state.currentTurn = nextPlayer;
        return;
      }

      attempts++;
    } while (attempts < maxAttempts);

    this.checkWinCondition();
  }

  private checkWinCondition(): void {
    const alivePlayers = this.state.players.filter((p) => p.alive);
    if (alivePlayers.length === 1) {
      this.state.gameOver = true;
      this.state.winner = alivePlayers[0]!.userId;
    } else if (alivePlayers.length === 0) {
      this.state.gameOver = true;
    }
  }

  getPlayerOrder(): string[] {
    return [...this.turnOrder];
  }

  getWordlist(): ReadonlySet<string> {
    return this.wordlist;
  }

  getWinner(): string | null {
    return this.state.winner;
  }
}
