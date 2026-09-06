import type { ActivityMode } from 'services/activity/gameId';
import type { ActionResult } from 'services/activity/shared/ActionResult';
import type { ActivityBroadcaster } from 'services/activity/shared/ActivityBroadcaster';
import { DisconnectGraceTimer } from 'services/activity/shared/DisconnectGraceTimer';
import {
  WORD_CHAIN_BOT_USER_ID,
  WordChainBot,
} from 'services/activity/word-chain/WordChainBot';
import {
  WordChainEngine,
  type WordChainState,
} from 'services/activity/word-chain/WordChainEngine';
import { GamificationService } from 'services/gamification';

export interface WordChainSessionIdentity {
  sessionKey: string;
  instanceId: string;
  guildId: string;
  mode: ActivityMode;
}

export interface WordChainSessionOptions {
  onSessionEnded?: () => void;
  disconnectGraceMs?: number;
  turnTimeoutMs?: number;
  botMoveDelayMs?: number;
  // Single/bot mode has no opponent to wait out — this is only long enough
  // to survive React StrictMode's dev-only phantom mount/unmount, not a
  // real reconnect window.
  singleModeDisconnectGraceMs?: number;
}

interface WordChainPlayer {
  userId: string;
  connected: boolean;
  // See PongSession: released only when the last connection drops, so a
  // superseded socket closing can never evict the one that replaced it.
  connections: Set<unknown>;
}

const DEFAULT_DISCONNECT_GRACE_MS = 30_000;
const DEFAULT_SINGLE_MODE_DISCONNECT_GRACE_MS = 1500;
const TURN_TIMEOUT_MS = 10_000;
const DEFAULT_BOT_MOVE_DELAY_MS = 900;
const MIN_PLAYERS_TO_START = 2;

export class WordChainSession {
  private engine: WordChainEngine;
  private players: WordChainPlayer[] = [];
  private broadcaster: ActivityBroadcaster;
  private disconnectGrace = new DisconnectGraceTimer<string>();
  private turnTimer: ReturnType<typeof setTimeout> | null = null;
  private gamification = new GamificationService();
  private sessionStartTime = Date.now();
  private resultRecorded = false;
  private readonly onSessionEnded?: () => void;
  private readonly disconnectGraceMs: number;
  private readonly singleModeDisconnectGraceMs: number;
  private readonly turnTimeoutMs: number;
  // Gates the turn clock: a solo player waiting for an opponent must not be
  // eliminated by a timer for a turn the match hasn't started yet.
  private started = false;
  // Elimination order, first-out first, so results can rank eliminated
  // players instead of dropping them from the record entirely.
  private eliminationOrder: string[] = [];
  private botUserId: string | null = null;
  private bot: WordChainBot | null = null;
  private readonly botMoveDelayMs: number;
  private botTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private identity: WordChainSessionIdentity,
    broadcaster: ActivityBroadcaster,
    options: WordChainSessionOptions = {},
  ) {
    this.broadcaster = broadcaster;
    this.engine = new WordChainEngine();
    this.onSessionEnded = options.onSessionEnded;
    this.disconnectGraceMs =
      options.disconnectGraceMs ?? DEFAULT_DISCONNECT_GRACE_MS;
    this.singleModeDisconnectGraceMs =
      options.singleModeDisconnectGraceMs ??
      DEFAULT_SINGLE_MODE_DISCONNECT_GRACE_MS;
    this.turnTimeoutMs = options.turnTimeoutMs ?? TURN_TIMEOUT_MS;
    this.botMoveDelayMs = options.botMoveDelayMs ?? DEFAULT_BOT_MOVE_DELAY_MS;
  }

  // Seats the bot as a genuine player — the engine tracks turn order over
  // real player ids, there's no "virtual side" the way a masked board game
  // has.
  enableBot(): void {
    if (this.botUserId) return;
    this.botUserId = WORD_CHAIN_BOT_USER_ID;
    this.bot = new WordChainBot(this.engine.getWordlist());
    this.addPlayer(this.botUserId, null);
  }

  private clearBotTimer(): void {
    if (this.botTimer) {
      clearTimeout(this.botTimer);
      this.botTimer = null;
    }
  }

  private maybeScheduleBotWord(): void {
    if (!this.bot || !this.botUserId) return;
    const state = this.engine.getState();
    if (state.gameOver || state.currentTurn !== this.botUserId) return;
    if (this.botTimer) return;

    this.botTimer = setTimeout(() => {
      this.botTimer = null;
      this.playBotWord();
    }, this.botMoveDelayMs);
  }

  private playBotWord(): void {
    if (!this.bot || !this.botUserId) return;
    const state = this.engine.getState();
    if (state.gameOver || state.currentTurn !== this.botUserId) return;

    const word = this.bot.chooseWord(state);
    // No candidate left in the local wordlist — leave the existing turn
    // timer to eliminate the bot exactly as it would a stuck human.
    if (!word) return;

    this.handleWordSubmission(this.botUserId, word);
  }

  get playerCount(): number {
    return this.players.length;
  }

  get state(): WordChainState {
    return this.engine.getState();
  }

  addPlayer(userId: string, connection: unknown): boolean {
    const existing = this.players.find((p) => p.userId === userId);
    if (existing) {
      existing.connections.add(connection);
      if (!existing.connected) {
        existing.connected = true;
        this.disconnectGrace.disarm(userId);
        this.broadcaster.broadcast(this.roomKey, {
          type: 'opponent_reconnected',
          payload: { userId },
        });
        // The turn clock was paused if it was this player's turn when they
        // dropped (see pauseForDisconnect) — resume it with a fresh window
        // now that they're back, without disturbing anyone else's turn.
        if (
          this.started &&
          !this.turnTimer &&
          !this.engine.getState().gameOver &&
          this.isCurrentTurn(userId)
        ) {
          this.resetTurnTimer();
        }
      }
      return true;
    }

    this.players.push({
      userId,
      connected: true,
      connections: new Set([connection]),
    });

    this.engine.addPlayer(userId);
    this.broadcastState();

    if (!this.started && this.players.length >= MIN_PLAYERS_TO_START) {
      this.started = true;
      this.resetTurnTimer();
    }

    return true;
  }

  private get roomKey(): string {
    return this.identity.sessionKey;
  }

  // Returns the outcome instead of broadcasting it — a rejection is feedback
  // for the submitting player only, so the Room delivers it via
  // `client.send`, never a room-wide broadcast (§6.3, AP-1).
  handleWordSubmission(userId: string, word: string): ActionResult {
    const result = this.engine.submitWord(userId, word);

    if (!result.valid) {
      return { ok: false, error: result.error ?? 'Invalid word' };
    }

    this.broadcastState();
    this.resetTurnTimer();

    if (this.engine.getState().gameOver) {
      this.endGame();
    } else {
      this.maybeScheduleBotWord();
    }

    return { ok: true };
  }

  // True when `connection` was the last socket holding the slot.
  private releaseConnection(
    player: WordChainPlayer,
    connection: unknown,
  ): boolean {
    player.connections.delete(connection);
    return player.connections.size === 0;
  }

  pauseForDisconnect(userId: string, connection: unknown): void {
    const player = this.players.find((p) => p.userId === userId);
    if (!player) return;
    if (!this.releaseConnection(player, connection)) return;

    if (this.engine.getState().gameOver) {
      this.eliminatePlayer(userId);
      return;
    }
    if (!player.connected) return;

    player.connected = false;
    if (this.identity.mode === 'multi') {
      this.broadcaster.broadcast(this.roomKey, {
        type: 'opponent_disconnected',
        payload: { userId, timeoutMs: this.disconnectGraceMs },
      });
    }
    // Grace is meaningless if the 10s turn clock keeps running underneath
    // it — the player would be eliminated by timeout well before the grace
    // ever lapses. Pausing the clock (Pong freezes the whole loop the same
    // way) means a reconnect within the grace window genuinely resumes the
    // same turn instead of a race against two independent timers.
    if (this.isCurrentTurn(userId) && this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = null;
    }
    // Single/bot mode has no opponent waiting, so its grace only needs to
    // be long enough to survive React StrictMode's dev-only phantom
    // mount/unmount — not a genuine reconnect window like multi's.
    const graceMs =
      this.identity.mode === 'multi'
        ? this.disconnectGraceMs
        : this.singleModeDisconnectGraceMs;
    this.disconnectGrace.arm(userId, graceMs, () => {
      this.eliminatePlayer(userId);
    });
  }

  private isCurrentTurn(userId: string): boolean {
    return this.engine.getState().currentTurn === userId;
  }

  leave(userId: string, connection: unknown): void {
    const player = this.players.find((p) => p.userId === userId);
    if (!player) return;
    if (!this.releaseConnection(player, connection)) return;

    this.disconnectGrace.disarm(userId);
    this.eliminatePlayer(userId);
  }

  private eliminatePlayer(userId: string): void {
    const playerIndex = this.players.findIndex((p) => p.userId === userId);
    if (playerIndex >= 0) {
      this.players.splice(playerIndex, 1);
      this.disconnectGrace.disarm(userId);
      this.eliminationOrder.push(userId);
      this.engine.removePlayer(userId);
      this.broadcastState();

      const state = this.engine.getState();
      if (state.gameOver) {
        this.endGame();
      } else if (this.started) {
        // The clock that timed this player out (or would have, had they not
        // been dropped/left) belongs to whoever they lost the turn to —
        // without this, the next player never gets a running timer and a
        // silent player stalls the match forever.
        this.resetTurnTimer();
        this.maybeScheduleBotWord();
      }
    }

    // The bot's own seat never leaves via disconnect/leave (it has no real
    // connection), so once every *real* player is gone the table is just as
    // empty as if `players` were literally [].
    const realPlayers = this.players.filter((p) => p.userId !== this.botUserId);
    if (realPlayers.length === 0) {
      this.clearBotTimer();
      this.onSessionEnded?.();
    }
  }

  private resetTurnTimer(): void {
    if (this.turnTimer) clearTimeout(this.turnTimer);

    this.turnTimer = setTimeout(() => {
      const state = this.engine.getState();
      if (!state.gameOver) {
        this.eliminatePlayer(state.currentTurn);
      }
    }, this.turnTimeoutMs);
  }

  private broadcastState(): void {
    const state = this.engine.getState();
    this.broadcaster.broadcast(this.roomKey, {
      type: 'state',
      payload: {
        gameOver: state.gameOver,
        winner: state.winner,
        currentTurn: state.currentTurn,
        currentWord: state.currentWord,
        usedWords: Array.from(state.usedWords),
        players: state.players,
      },
    });
  }

  private endGame(): void {
    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = null;
    }
    this.disconnectGrace.clear();

    const state = this.engine.getState();
    const durationMs = Date.now() - this.sessionStartTime;

    if (!this.resultRecorded && state.players.length >= 2 && !this.botUserId) {
      this.resultRecorded = true;
      // Winner (if any) takes 1st; eliminated players rank by reverse
      // elimination order — the last one out placed just behind the
      // winner, the first one out placed last. Every real player gets a
      // record, not just whoever happened to survive.
      const results = state.players.map((p) => {
        if (p.alive) return { userId: p.userId, position: 1 };
        const eliminatedIndex = this.eliminationOrder.indexOf(p.userId);
        const reverseRank =
          eliminatedIndex === -1
            ? this.eliminationOrder.length
            : this.eliminationOrder.length - 1 - eliminatedIndex;
        return {
          userId: p.userId,
          position: (state.winner ? 2 : 1) + reverseRank,
        };
      });

      this.gamification.recordGameResult({
        sessionId: this.identity.instanceId,
        guildId: this.identity.guildId,
        gameType: 'word-chain',
        durationMs,
        results,
      });
    }

    this.broadcastState();
  }

  // MANDATORY per §6.2: stops the turn timer and clears disconnect grace so
  // neither can fire into a room that Colyseus has already disposed.
  dispose(): void {
    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = null;
    }
    this.clearBotTimer();
    this.disconnectGrace.clear();
  }
}
