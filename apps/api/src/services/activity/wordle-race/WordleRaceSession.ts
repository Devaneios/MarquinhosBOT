import type { ActivityMode } from 'services/activity/gameId';
import type { ActionResult } from 'services/activity/shared/ActionResult';
import type { ActivityBroadcaster } from 'services/activity/shared/ActivityBroadcaster';
import { WordleRaceEngine } from 'services/activity/wordle-race/WordleRaceEngine';
import { GamificationService } from 'services/gamification';

interface WordleRaceSessionIdentity {
  sessionKey: string;
  instanceId: string;
  guildId: string;
  mode: ActivityMode;
}

interface WordleRacePlayer {
  userId: string;
  connected: boolean;
  connections: Set<unknown>;
}

export interface WordleRaceSessionOptions {
  onSessionEnded?: () => void;
}

export class WordleRaceSession {
  private engine: WordleRaceEngine;
  private players: WordleRacePlayer[] = [];
  private readonly roomKey: string;
  private gamification: GamificationService;
  private resultRecorded = false;
  private readonly onSessionEnded?: () => void;
  private endGameTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private identity: WordleRaceSessionIdentity,
    private broadcaster: ActivityBroadcaster,
    gamification: GamificationService = new GamificationService(),
    options: WordleRaceSessionOptions = {},
  ) {
    this.roomKey = identity.sessionKey;
    this.gamification = gamification;
    this.onSessionEnded = options.onSessionEnded;

    const targetWord = this.pickRandomWord();
    this.engine = new WordleRaceEngine(targetWord, Date.now());
  }

  private pickRandomWord(): string {
    const wordlist = [
      'abrir',
      'acaso',
      'aceno',
      'aceso',
      'aceto',
      'achar',
      'acima',
      'acaba',
      'acabo',
      'acaju',
      'acari',
      'adaga',
      'adega',
      'adeus',
      'adiar',
      'adobe',
      'adubo',
      'afago',
      'afeto',
      'afiar',
      'agave',
      'agora',
      'aguar',
      'agudo',
      'ainda',
      'ajuda',
      'alado',
      'alama',
      'alano',
      'alces',
      'alelo',
      'aleta',
      'alfas',
      'algar',
      'algoz',
      'alias',
      'alibe',
      'alice',
      'aliei',
      'aliem',
      'alier',
      'alies',
      'alifs',
      'alijo',
      'alila',
      'alima',
      'alimo',
      'aline',
    ];
    return wordlist[Math.floor(Math.random() * wordlist.length)]!;
  }

  get playerCount(): number {
    return this.players.length;
  }

  addPlayer(userId: string, connection: unknown): void {
    const existing = this.players.find((p) => p.userId === userId);
    if (existing) {
      existing.connections.add(connection);
      existing.connected = true;
      this.engine.addPlayer(userId);
      this.broadcastPlayerJoined(userId);
      return;
    }

    this.players.push({
      userId,
      connected: true,
      connections: new Set([connection]),
    });
    this.engine.addPlayer(userId);
    this.broadcastPlayerJoined(userId);
  }

  private releaseConnection(
    player: WordleRacePlayer,
    connection: unknown,
  ): boolean {
    player.connections.delete(connection);
    return player.connections.size === 0;
  }

  // A race has no opponent slot to hold open for a reconnect — everyone
  // else keeps racing regardless — so both a network drop and an explicit
  // exit free the player immediately (§6.2's "decide grace-or-detach
  // explicitly" for grace-less sessions).
  pauseForDisconnect(userId: string, connection: unknown) {
    this.leave(userId, connection);
  }

  leave(userId: string, connection: unknown) {
    const player = this.players.find((p) => p.userId === userId);
    if (!player) return;

    if (!this.releaseConnection(player, connection)) return;

    player.connected = false;
    this.engine.removePlayer(userId);
    this.broadcastPlayerLeft(userId);

    if (this.engine.isGameOver()) {
      this.endGame();
    }
  }

  // Returns the outcome instead of broadcasting a rejection — an invalid
  // guess is feedback for the submitter only, so the Room delivers it via
  // `client.send`, never a room-wide broadcast (§6.3, AP-1).
  submitGuess(userId: string, guess: string): ActionResult {
    const result = this.engine.submitGuess(userId, guess);

    if ('error' in result) {
      return { ok: false, error: result.error };
    }

    const engineState = this.engine.getState();
    const player = engineState.players.get(userId);

    this.broadcaster.broadcast(this.roomKey, {
      type: 'guess_submitted',
      payload: {
        userId,
        guess,
        feedback: result.feedback,
        attempts: player?.attempts ?? 0,
        solved: result.solved,
      },
    });

    if (result.solved) {
      this.broadcaster.broadcast(this.roomKey, {
        type: 'player_solved',
        payload: {
          userId,
          firstSolver: engineState.firstSolver === userId,
        },
      });
    }

    if (player?.exhausted) {
      this.broadcaster.broadcast(this.roomKey, {
        type: 'player_exhausted',
        payload: { userId },
      });
    }

    if (this.engine.isGameOver()) {
      this.endGame();
    }

    return { ok: true };
  }

  private broadcastPlayerJoined(userId: string) {
    this.broadcaster.broadcast(this.roomKey, {
      type: 'player_joined',
      payload: {
        userId,
        targetWordLength: this.engine.getTargetWord().length,
        maxAttempts: this.engine.getMaxAttempts(),
        totalPlayers: this.players.length,
      },
    });
  }

  private broadcastPlayerLeft(userId: string) {
    this.broadcaster.broadcast(this.roomKey, {
      type: 'player_left',
      payload: { userId },
    });
  }

  private endGame() {
    if (this.resultRecorded) return;
    this.resultRecorded = true;

    const engineState = this.engine.getState();
    const results = Array.from(engineState.players.values())
      .sort((a, b) => {
        if (a.solved && !b.solved) return -1;
        if (!a.solved && b.solved) return 1;
        return a.attempts - b.attempts;
      })
      .map((player, index) => ({
        userId: player.userId,
        position: index + 1,
        solved: player.solved,
      }));

    this.broadcaster.broadcast(this.roomKey, {
      type: 'game_ended',
      payload: {
        targetWord: engineState.targetWord,
        results,
      },
    });

    try {
      this.gamification.recordGameResult({
        sessionId: this.identity.instanceId,
        guildId: this.identity.guildId,
        gameType: 'wordle-race',
        results: results.map((r) => ({
          userId: r.userId,
          position: r.position,
        })),
      });
    } catch (err) {
      console.error('Failed to record game result:', err);
    }

    if (this.onSessionEnded) {
      this.endGameTimer = setTimeout(() => this.onSessionEnded?.(), 3000);
    }
  }

  getGameState(userId: string) {
    const engineState = this.engine.getState();
    const player = engineState.players.get(userId);
    return {
      targetWordLength: engineState.targetWord.length,
      maxAttempts: this.engine.getMaxAttempts(),
      players: Array.from(engineState.players.entries()).map(
        ([playerId, p]) => ({
          userId: playerId,
          attempts: p.attempts,
          solved: p.solved,
          exhausted: p.exhausted,
          guesses: p.guesses,
        }),
      ),
      firstSolver: engineState.firstSolver,
      gameOver: this.engine.isGameOver(),
      // Denormalized view of the requesting player's own guesses — the
      // client merges `guess_submitted` deltas into these same fields, so
      // `init` must seed them in the same shape.
      currentPlayerGuesses: player?.guesses ?? [],
      currentPlayerSolved: player?.solved ?? false,
      currentPlayerExhausted: player?.exhausted ?? false,
    };
  }

  // MANDATORY per §6.2: clears the post-game finish timer so it can't fire
  // `onSessionEnded` into an already-disposed room.
  dispose(): void {
    if (this.endGameTimer) {
      clearTimeout(this.endGameTimer);
      this.endGameTimer = null;
    }
  }
}
