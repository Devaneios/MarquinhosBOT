import { ConnectFourBot } from 'services/activity/connectFour/ConnectFourBot';
import {
  ConnectFourEngine,
  type ConnectFourState,
  type Disc,
} from 'services/activity/connectFour/ConnectFourEngine';
import type { ActivityMode } from 'services/activity/gameId';
import type { ActivityBroadcaster } from 'services/activity/shared/ActivityBroadcaster';
import { DisconnectGraceTimer } from 'services/activity/shared/DisconnectGraceTimer';
import { GamificationService } from 'services/gamification';

interface ConnectFourPlayer {
  userId: string;
  disc: Disc;
  connected: boolean;
  connections: Set<unknown>;
}

export interface ConnectFourSessionIdentity {
  sessionKey: string;
  instanceId: string;
  guildId: string;
  mode: ActivityMode;
}

export interface ConnectFourSessionOptions {
  onSessionEnded?: () => void;
  disconnectGraceMs?: number;
  botMoveDelayMs?: number;
}

const DEFAULT_DISCONNECT_GRACE_MS = 30_000;
const DEFAULT_BOT_MOVE_DELAY_MS = 500;

export class ConnectFourSession {
  private engine = new ConnectFourEngine();
  private players: ConnectFourPlayer[] = [];
  private resultRecorded = false;
  private botDisc: Disc = 'p2';
  private bot: ConnectFourBot | null = null;
  private restartVotes = new Set<string>();
  private disconnectGrace = new DisconnectGraceTimer<string>();
  private readonly onSessionEnded?: () => void;
  private readonly disconnectGraceMs: number;
  private readonly botMoveDelayMs: number;
  private botTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private identity: ConnectFourSessionIdentity,
    private broadcaster: ActivityBroadcaster,
    private gamification: GamificationService = new GamificationService(),
    options: ConnectFourSessionOptions = {},
  ) {
    this.onSessionEnded = options.onSessionEnded;
    this.disconnectGraceMs =
      options.disconnectGraceMs ?? DEFAULT_DISCONNECT_GRACE_MS;
    this.botMoveDelayMs = options.botMoveDelayMs ?? DEFAULT_BOT_MOVE_DELAY_MS;
  }

  get playerCount(): number {
    return this.players.length;
  }

  private get roomKey(): string {
    return this.identity.sessionKey;
  }

  addPlayer(userId: string, connection: unknown): Disc | null {
    const existing = this.players.find((p) => p.userId === userId);
    if (existing) {
      existing.connections.add(connection);
      if (!existing.connected) this.resumeExisting(existing);
      return existing.disc;
    }
    if (this.players.length >= 2) return null;
    const disc: Disc = this.players.length === 0 ? 'p1' : 'p2';
    this.players.push({
      userId,
      disc,
      connected: true,
      connections: new Set([connection]),
    });
    return disc;
  }

  private releaseConnection(
    player: ConnectFourPlayer,
    connection: unknown,
  ): boolean {
    player.connections.delete(connection);
    return player.connections.size === 0;
  }

  private resumeExisting(player: ConnectFourPlayer) {
    player.connected = true;
    this.disconnectGrace.disarm(player.userId);
    this.broadcaster.broadcast(this.roomKey, {
      type: 'opponent_reconnected',
      payload: { disc: player.disc },
    });
    this.broadcastState();
  }

  pauseForDisconnect(userId: string, connection: unknown) {
    const player = this.players.find((p) => p.userId === userId);
    if (!player) return;
    if (!this.releaseConnection(player, connection)) return;

    if (this.identity.mode !== 'multi' || this.engine.getState().winner) {
      this.detach(userId);
      return;
    }
    if (!player.connected) return;

    player.connected = false;
    this.broadcaster.broadcast(this.roomKey, {
      type: 'opponent_disconnected',
      payload: { disc: player.disc, timeoutMs: this.disconnectGraceMs },
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
    if (!remaining || this.engine.getState().winner) return;

    this.engine.forceWinner(remaining.disc);
    const state = this.broadcastState();
    if (!this.resultRecorded) {
      this.resultRecorded = true;
      this.recordResult(state.winner!);
    }
  }

  private removePlayer(userId: string) {
    this.players = this.players.filter((p) => p.userId !== userId);
    this.restartVotes.delete(userId);
    if (this.players.length === 0) {
      this.clearBotTimer();
      this.onSessionEnded?.();
    }
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
    return this.players.find((p) => p.disc === winner)?.userId ?? null;
  }

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
      disc: outgoing.disc,
      connected: true,
      connections: new Set([connection]),
    });
    return true;
  }

  enableBot(humanDisc?: Disc) {
    if (humanDisc) {
      this.botDisc = humanDisc === 'p1' ? 'p2' : 'p1';
    }
    this.bot = new ConnectFourBot(this.botDisc);
  }

  getPublicState() {
    return this.engine.getState();
  }

  // Returns whether the move was accepted, so the room can tell the sending
  // client "no" directly instead of every player in the session getting a
  // rejection meant for one of them.
  dropDisc(userId: string, col: number): boolean {
    const player = this.players.find((p) => p.userId === userId);
    if (!player) return false;

    const result = this.engine.dropDisc(col, player.disc);
    if (!result) return false;

    const state = this.broadcastState();
    if (state.winner && !this.resultRecorded) {
      this.resultRecorded = true;
      this.recordResult(state.winner);
      return true;
    }
    if (state.isDraw) return true;

    this.maybeScheduleBotMove(state);
    return true;
  }

  private maybeScheduleBotMove(state: ConnectFourState) {
    if (!this.bot || state.currentTurn !== this.botDisc) return;
    this.clearBotTimer();
    this.botTimer = setTimeout(() => {
      this.botTimer = null;
      this.playBotMove();
    }, this.botMoveDelayMs);
  }

  private playBotMove() {
    if (!this.bot) return;
    const current = this.engine.getState();
    if (current.winner || current.currentTurn !== this.botDisc) return;

    const col = this.bot.chooseColumn(this.engine);
    if (col === null) return;

    const result = this.engine.dropDisc(col, this.botDisc);
    if (!result) return;

    const state = this.broadcastState();
    if (state.winner && !this.resultRecorded) {
      this.resultRecorded = true;
      this.recordResult(state.winner);
    }
  }

  private clearBotTimer() {
    if (this.botTimer) {
      clearTimeout(this.botTimer);
      this.botTimer = null;
    }
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
    this.clearBotTimer();
    this.engine = new ConnectFourEngine();
    this.broadcastState();
  }

  private broadcastState(): ConnectFourState {
    const state = this.engine.getState();
    this.broadcaster.broadcast(this.roomKey, {
      type: 'state',
      payload: state,
    });
    return state;
  }

  private recordResult(winner: Disc) {
    if (this.players.length < 2) return;
    this.gamification.recordGameResult({
      sessionId: this.identity.instanceId,
      guildId: this.identity.guildId,
      gameType: 'connect-four',
      results: this.players.map((player) => ({
        userId: player.userId,
        position: player.disc === winner ? 1 : 2,
      })),
    });
  }

  // MANDATORY per §6.2: clears the bot timer and disconnect grace so
  // neither outlives a disposed room.
  dispose(): void {
    this.clearBotTimer();
    this.disconnectGrace.clear();
  }
}
