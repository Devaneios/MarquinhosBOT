import type { ActivityMode } from 'services/activity/gameId';
import { HangmanEngine } from 'services/activity/hangman/HangmanEngine';
import type { ActivityBroadcaster } from 'services/activity/shared/ActivityBroadcaster';
import { DisconnectGraceTimer } from 'services/activity/shared/DisconnectGraceTimer';
import { GamificationService } from 'services/gamification';

interface HangmanPlayer {
  userId: string;
  connected: boolean;
  connections: Set<unknown>;
}

export interface HangmanSessionIdentity {
  sessionKey: string;
  instanceId: string;
  guildId: string;
  mode: ActivityMode;
}

export interface HangmanSessionOptions {
  onSessionEnded?: () => void;
  disconnectGraceMs?: number;
}

const DEFAULT_DISCONNECT_GRACE_MS = 30_000;

export class HangmanSession {
  private engine: HangmanEngine;
  private players: HangmanPlayer[] = [];
  private resultRecorded = false;
  private disconnectGrace = new DisconnectGraceTimer<string>();
  private readonly onSessionEnded?: () => void;
  private readonly disconnectGraceMs: number;

  constructor(
    private identity: HangmanSessionIdentity,
    private broadcaster: ActivityBroadcaster,
    private gamification: GamificationService = new GamificationService(),
    word: string,
    options: HangmanSessionOptions = {},
  ) {
    this.engine = new HangmanEngine(word);
    this.onSessionEnded = options.onSessionEnded;
    this.disconnectGraceMs =
      options.disconnectGraceMs ?? DEFAULT_DISCONNECT_GRACE_MS;
  }

  get playerCount(): number {
    return this.players.length;
  }

  private get roomKey(): string {
    return this.identity.sessionKey;
  }

  addPlayer(userId: string, connection: unknown): boolean {
    const existing = this.players.find((p) => p.userId === userId);
    if (existing) {
      existing.connections.add(connection);
      if (!existing.connected) this.resumeExisting(existing);
      return true;
    }
    if (this.players.length >= 4) return false;

    this.players.push({
      userId,
      connected: true,
      connections: new Set([connection]),
    });

    return true;
  }

  private resumeExisting(player: HangmanPlayer): void {
    player.connected = true;
    this.disconnectGrace.disarm(player.userId);
  }

  guessLetter(
    userId: string,
    letter: string,
  ): { success: boolean; message?: string } {
    const player = this.players.find((p) => p.userId === userId);
    if (!player) {
      return { success: false, message: 'Player not in session' };
    }

    if (
      !letter ||
      letter.length !== 1 ||
      !/[a-záàâãéèêíïóôõöúçñ]/i.test(letter)
    ) {
      return { success: false, message: 'Invalid letter' };
    }

    const result = this.engine.guessLetter(letter);
    if (!result) {
      return { success: false, message: 'Letter already guessed' };
    }

    const state = this.engine.getState();
    this.broadcaster.broadcast(this.roomKey, {
      type: 'game_state',
      payload: {
        revealedWord: this.engine.getRevealedWord(),
        guessedLetters: Array.from(state.guessedLetters).sort(),
        strikes: state.strikes,
        maxStrikes: state.maxStrikes,
        gameOver: state.gameOver,
        won: state.won,
      },
    });

    if (state.gameOver) {
      this.recordResult(state.won);
    }

    return { success: true };
  }

  private recordResult(won: boolean): void {
    if (this.resultRecorded) return;
    this.resultRecorded = true;

    const players = this.players.map((p) => ({
      userId: p.userId,
      won,
    }));

    this.gamification.recordGameResult({
      sessionId: this.identity.instanceId,
      guildId: this.identity.guildId,
      gameType: 'hangman',
      results: players.map((p) => ({
        userId: p.userId,
        position: p.won ? 1 : 2,
      })),
    });
  }

  getState(): {
    revealedWord: string;
    guessedLetters: string[];
    strikes: number;
    maxStrikes: number;
    gameOver: boolean;
    won: boolean;
  } {
    const state = this.engine.getState();
    return {
      revealedWord: this.engine.getRevealedWord(),
      guessedLetters: Array.from(state.guessedLetters).sort(),
      strikes: state.strikes,
      maxStrikes: state.maxStrikes,
      gameOver: state.gameOver,
      won: state.won,
    };
  }

  pauseForDisconnect(userId: string, connection: unknown): void {
    const player = this.players.find((p) => p.userId === userId);
    if (!player) return;

    player.connections.delete(connection);
    if (player.connections.size > 0) return;

    // Only 'multi' holds the slot open for a reconnect; single mode has no
    // opponent waiting, and a finished game has nothing left to hold open
    // (§6.2).
    if (this.identity.mode !== 'multi' || this.engine.getState().gameOver) {
      this.forceDisconnect(userId);
      return;
    }

    player.connected = false;
    this.disconnectGrace.arm(userId, this.disconnectGraceMs, () =>
      this.forceDisconnect(userId),
    );
  }

  private forceDisconnect(userId: string): void {
    this.disconnectGrace.disarm(userId);
    const idx = this.players.findIndex((p) => p.userId === userId);
    if (idx === -1) return;
    this.players.splice(idx, 1);

    if (this.players.length === 0) {
      this.onSessionEnded?.();
    }
  }

  // MANDATORY per §6.2: clears disconnect grace so it can't outlive a
  // disposed room.
  dispose(): void {
    this.disconnectGrace.clear();
  }
}
