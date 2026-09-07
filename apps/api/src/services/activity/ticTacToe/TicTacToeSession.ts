import type { ActivityMode } from 'services/activity/gameId';
import type { ActionResult } from 'services/activity/shared/ActionResult';
import type { ActivityBroadcaster } from 'services/activity/shared/ActivityBroadcaster';
import { DisconnectGraceTimer } from 'services/activity/shared/DisconnectGraceTimer';
import { TicTacToeBot } from 'services/activity/ticTacToe/TicTacToeBot';
import {
  TicTacToeEngine,
  type Player,
} from 'services/activity/ticTacToe/TicTacToeEngine';
import { GamificationService } from 'services/gamification';

interface TicTacToePlayer {
  userId: string;
  player: Player;
  connected: boolean;
  connections: Set<unknown>;
}

export interface TicTacToeSessionIdentity {
  sessionKey: string;
  instanceId: string;
  guildId: string;
  mode: ActivityMode;
}

export interface TicTacToeSessionOptions {
  onSessionEnded?: () => void;
  disconnectGraceMs?: number;
  botMoveDelayMs?: number;
}

const DEFAULT_DISCONNECT_GRACE_MS = 30_000;
const DEFAULT_BOT_MOVE_DELAY_MS = 500;

export class TicTacToeSession {
  private engine: TicTacToeEngine;
  private players: TicTacToePlayer[] = [];
  private resultRecorded = false;
  private restartVotes = new Set<string>();
  private disconnectGrace = new DisconnectGraceTimer<string>();
  private readonly onSessionEnded?: () => void;
  private readonly disconnectGraceMs: number;
  private bot: TicTacToeBot | null = null;
  private readonly botMoveDelayMs: number;
  private botTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private identity: TicTacToeSessionIdentity,
    private broadcaster: ActivityBroadcaster,
    private gamification: GamificationService = new GamificationService(),
    options: TicTacToeSessionOptions = {},
  ) {
    this.engine = new TicTacToeEngine();
    this.onSessionEnded = options.onSessionEnded;
    this.disconnectGraceMs =
      options.disconnectGraceMs ?? DEFAULT_DISCONNECT_GRACE_MS;
    this.botMoveDelayMs = options.botMoveDelayMs ?? DEFAULT_BOT_MOVE_DELAY_MS;
  }

  enableBot(humanPlayer?: Player) {
    const botPlayer: Player = humanPlayer === 'X' ? 'O' : 'X';
    this.bot = new TicTacToeBot(botPlayer);
    this.maybeScheduleBotMove();
  }

  private maybeScheduleBotMove() {
    if (!this.bot) return;
    const state = this.engine.getState();
    if (state.winner || state.isDraw) return;
    if (state.currentPlayer !== this.bot.side) return;
    if (this.botTimer) return;

    this.botTimer = setTimeout(() => {
      this.botTimer = null;
      this.playBotMove();
    }, this.botMoveDelayMs);
  }

  private playBotMove() {
    if (!this.bot) return;
    const state = this.engine.getState();
    if (state.winner || state.isDraw || state.currentPlayer !== this.bot.side)
      return;

    const move = this.bot.chooseMove(state.board);
    if (!move) return;

    const result = this.engine.makeMove(move.row, move.col, this.bot.side);
    if (!result.success) return;

    const updatedState = this.broadcastState();
    if (updatedState.winner || updatedState.isDraw) {
      if (!this.resultRecorded) {
        this.resultRecorded = true;
        if (updatedState.winner) this.recordResult(updatedState.winner);
      }
      return;
    }

    this.maybeScheduleBotMove();
  }

  private clearBotTimer() {
    if (this.botTimer) {
      clearTimeout(this.botTimer);
      this.botTimer = null;
    }
  }

  get playerCount(): number {
    return this.players.length;
  }

  private get roomKey(): string {
    return this.identity.sessionKey;
  }

  addPlayer(userId: string, connection: unknown): Player | null {
    const existing = this.players.find((p) => p.userId === userId);
    if (existing) {
      existing.connections.add(connection);
      if (!existing.connected) this.resumeExisting(existing);
      return existing.player;
    }
    if (this.players.length >= 2) return null;
    const player: Player = this.players.length === 0 ? 'X' : 'O';
    this.players.push({
      userId,
      player,
      connected: true,
      connections: new Set([connection]),
    });
    return player;
  }

  private releaseConnection(
    player: TicTacToePlayer,
    connection: unknown,
  ): boolean {
    player.connections.delete(connection);
    return player.connections.size === 0;
  }

  private resumeExisting(player: TicTacToePlayer) {
    player.connected = true;
    this.disconnectGrace.disarm(player.userId);
    this.broadcaster.broadcast(this.roomKey, {
      type: 'opponent_reconnected',
      payload: { player: player.player },
    });
  }

  pauseForDisconnect(userId: string, connection: unknown) {
    const player = this.players.find((p) => p.userId === userId);
    if (!player) return;
    if (!this.releaseConnection(player, connection)) return;

    const state = this.engine.getState();
    if (this.identity.mode !== 'multi' || state.winner || state.isDraw) {
      this.detach(userId);
      return;
    }
    if (!player.connected) return;

    player.connected = false;
    this.broadcaster.broadcast(this.roomKey, {
      type: 'opponent_disconnected',
      payload: { player: player.player, timeoutMs: this.disconnectGraceMs },
    });
    this.disconnectGrace.arm(userId, this.disconnectGraceMs, () =>
      this.forfeitDisconnected(userId),
    );
  }

  private forfeitDisconnected(userId: string) {
    const player = this.players.find((p) => p.userId === userId);
    if (!player || player.connected) return;

    this.forfeitTo(userId);
    this.removePlayer(userId);
  }

  private detach(userId: string) {
    this.disconnectGrace.disarm(userId);
    this.forfeitTo(userId);
    this.removePlayer(userId);
  }

  private forfeitTo(userId: string) {
    const remaining = this.players.find(
      (p) => p.userId !== userId && p.connected,
    );
    if (!remaining) return;

    const state = this.engine.getState();
    if (state.winner || state.isDraw) return;

    const winner = remaining.player;
    this.engine.makeMove(-1, -1, winner);
    const updatedState = this.broadcastState();
    if (!this.resultRecorded) {
      this.resultRecorded = true;
      this.recordResult(updatedState.winner!);
    }
  }

  private removePlayer(userId: string) {
    this.players = this.players.filter((p) => p.userId !== userId);
    this.restartVotes.delete(userId);
    if (this.players.length === 0) this.onSessionEnded?.();
  }

  leave(userId: string, connection: unknown) {
    const player = this.players.find((p) => p.userId === userId);
    if (!player) return;
    if (!this.releaseConnection(player, connection)) return;

    this.detach(userId);
  }

  getWinnerUserId(): string | null {
    const winner = this.engine.getState().winner;
    if (!winner) return null;
    return this.players.find((p) => p.player === winner)?.userId ?? null;
  }

  // Reseats `incomingUserId` into whichever marker `outgoingUserId` held,
  // without the forfeit/onSessionEnded side effects `detach`/`leave` carry —
  // this runs between matches during queue rotation, never mid-match.
  // addPlayer() can't be reused here: it assigns markers by array length
  // (`players.length === 0 ? 'X' : 'O'`), which collides with the remaining
  // player's marker once one seat is vacated and refilled.
  substitutePlayer(
    outgoingUserId: string,
    incomingUserId: string,
    connection: unknown,
  ): boolean {
    const outgoing = this.players.find((p) => p.userId === outgoingUserId);
    if (!outgoing) return false;

    this.players = this.players.filter((p) => p.userId !== outgoingUserId);
    this.restartVotes.delete(outgoingUserId);
    this.players.push({
      userId: incomingUserId,
      player: outgoing.player,
      connected: true,
      connections: new Set([connection]),
    });
    return true;
  }

  // Returns the outcome instead of broadcasting a rejection — a rejected
  // move is feedback for the mover only, so the Room delivers it via
  // `client.send`, never a room-wide broadcast (§6.3, AP-1).
  handleMove(userId: string, row: number, col: number): ActionResult {
    const player = this.players.find((p) => p.userId === userId);
    if (!player) return { ok: false, error: 'Not seated at this match' };

    const result = this.engine.makeMove(row, col, player.player);

    if (!result.success) {
      return { ok: false, error: result.error ?? 'Invalid move' };
    }

    const updatedState = this.broadcastState();

    if (updatedState.winner || updatedState.isDraw) {
      if (!this.resultRecorded) {
        this.resultRecorded = true;
        if (updatedState.winner) {
          this.recordResult(updatedState.winner);
        }
      }
    } else {
      this.maybeScheduleBotMove();
    }

    return { ok: true };
  }

  private broadcastState() {
    const state = this.engine.getState();
    this.broadcaster.broadcast(this.roomKey, {
      type: 'state_update',
      payload: {
        board: state.board,
        currentPlayer: state.currentPlayer,
        winner: state.winner,
        isDraw: state.isDraw,
        moveCount: state.moveCount,
      },
    });
    return state;
  }

  requestRestart(userId: string) {
    const state = this.engine.getState();
    if (!state.winner && !state.isDraw) return;
    if (!this.players.some((p) => p.userId === userId)) return;

    this.restartVotes.add(userId);
    const required = this.bot ? 1 : this.players.length;

    if (this.restartVotes.size < required) {
      this.broadcaster.broadcast(this.roomKey, {
        type: 'restart_status',
        payload: { votes: this.restartVotes.size, required },
      });
      return;
    }

    this.restartVotes.clear();
    this.resultRecorded = false;
    this.engine.reset();
    this.broadcastState();
    this.maybeScheduleBotMove();
  }

  getPublicState() {
    const state = this.engine.getState();
    return {
      board: state.board,
      currentPlayer: state.currentPlayer,
      winner: state.winner,
      isDraw: state.isDraw,
      moveCount: state.moveCount,
    };
  }

  private recordResult(winner: Player) {
    if (this.players.length < 2) return;
    this.gamification.recordGameResult({
      sessionId: this.identity.instanceId,
      guildId: this.identity.guildId,
      gameType: 'tic-tac-toe',
      results: this.players.map((player) => ({
        userId: player.userId,
        position: player.player === winner ? 1 : 2,
      })),
    });
  }

  // MANDATORY per §6.2: clears disconnect grace so it can't outlive a
  // disposed room.
  dispose(): void {
    this.clearBotTimer();
    this.disconnectGrace.clear();
  }
}
