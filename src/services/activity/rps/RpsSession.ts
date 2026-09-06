import type { ActivityMode } from 'services/activity/gameId';
import {
  RpsEngine,
  type RpsEngineConfig,
  type RpsPick,
} from 'services/activity/rps/RpsEngine';
import type { ActivityBroadcaster } from 'services/activity/shared/ActivityBroadcaster';
import { DisconnectGraceTimer } from 'services/activity/shared/DisconnectGraceTimer';
import { GamificationService } from 'services/gamification';

const BOT_PICKS: RpsPick[] = ['rock', 'paper', 'scissors'];
const DEFAULT_BOT_PICK_DELAY_MS = 600;

interface RpsPlayer {
  userId: string;
  playerId: 'player1' | 'player2';
  connected: boolean;
  connections: Set<unknown>;
}

export interface RpsSessionIdentity {
  sessionKey: string;
  instanceId: string;
  guildId: string;
  mode: ActivityMode;
}

export interface RpsSessionOptions {
  onSessionEnded?: () => void;
  disconnectGraceMs?: number;
  botPickDelayMs?: number;
}

const DEFAULT_DISCONNECT_GRACE_MS = 30_000;

export class RpsSession {
  private engine: RpsEngine;
  private players: RpsPlayer[] = [];
  private resultRecorded = false;
  private lastWinnerUserId: string | null = null;
  private disconnectGrace = new DisconnectGraceTimer<string>();
  private readonly onSessionEnded?: () => void;
  private readonly disconnectGraceMs: number;
  private botPlayerId: 'player1' | 'player2' | null = null;
  private readonly botPickDelayMs: number;
  private botTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private identity: RpsSessionIdentity,
    private broadcaster: ActivityBroadcaster,
    private gamification: GamificationService = new GamificationService(),
    engineConfig: RpsEngineConfig = {},
    options: RpsSessionOptions = {},
  ) {
    this.engine = new RpsEngine(engineConfig);
    this.onSessionEnded = options.onSessionEnded;
    this.disconnectGraceMs =
      options.disconnectGraceMs ?? DEFAULT_DISCONNECT_GRACE_MS;
    this.botPickDelayMs = options.botPickDelayMs ?? DEFAULT_BOT_PICK_DELAY_MS;
  }

  enableBot(humanPlayerId?: 'player1' | 'player2') {
    this.botPlayerId = humanPlayerId === 'player1' ? 'player2' : 'player1';
  }

  private clearBotTimer() {
    if (this.botTimer) {
      clearTimeout(this.botTimer);
      this.botTimer = null;
    }
  }

  private maybeScheduleBotPick() {
    if (!this.botPlayerId) return;
    const state = this.engine.getRoundState();
    if (state.submitted.includes(this.botPlayerId)) return;
    if (this.botTimer) return;

    this.botTimer = setTimeout(() => {
      this.botTimer = null;
      const pick = BOT_PICKS[Math.floor(Math.random() * BOT_PICKS.length)]!;
      this.applyPick(this.botPlayerId!, pick);
    }, this.botPickDelayMs);
  }

  get playerCount(): number {
    return this.players.length;
  }

  private get roomKey(): string {
    return this.identity.sessionKey;
  }

  addPlayer(userId: string, connection: unknown): 'player1' | 'player2' | null {
    const existing = this.players.find((p) => p.userId === userId);
    if (existing) {
      existing.connections.add(connection);
      if (!existing.connected) this.resumeExisting(existing);
      return existing.playerId;
    }
    if (this.players.length >= 2) return null;

    const playerId: 'player1' | 'player2' =
      this.players.length === 0 ? 'player1' : 'player2';
    this.players.push({
      userId,
      playerId,
      connected: true,
      connections: new Set([connection]),
    });

    return playerId;
  }

  private resumeExisting(player: RpsPlayer) {
    player.connected = true;
    this.disconnectGrace.disarm(player.userId);
    this.broadcastState();
  }

  submitPick(userId: string, pick: unknown): boolean {
    const player = this.players.find((p) => p.userId === userId);
    if (!player) return false;

    const success = this.applyPick(player.playerId, pick);
    if (!success) return false;

    this.maybeScheduleBotPick();
    return true;
  }

  private applyPick(playerId: 'player1' | 'player2', pick: unknown): boolean {
    const success = this.engine.submitPick(playerId, pick);
    if (!success) return false;

    const state = this.engine.getRoundState();
    this.broadcaster.broadcast(this.roomKey, {
      type: 'round_state',
      payload: state,
    });

    if (state.submitted.length === 2) {
      const roundResult = this.engine.resolveRound();
      this.broadcaster.broadcast(this.roomKey, {
        type: 'round_result',
        payload: roundResult,
      });

      const matchWinner = this.engine.getMatchWinner();
      if (matchWinner) {
        this.endMatch(matchWinner);
      } else {
        // resolveRound() advances to the next round and clears submitted
        // picks — without this, the client's `submitted` array is stale
        // (still lists both players from the just-finished round), which
        // permanently disables the pick buttons for the new round.
        this.broadcaster.broadcast(this.roomKey, {
          type: 'round_state',
          payload: this.engine.getRoundState(),
        });
      }
    }

    return true;
  }

  private endMatch(winnerId: 'player1' | 'player2') {
    if (this.resultRecorded) return;
    this.resultRecorded = true;
    this.clearBotTimer();

    const winner = this.players.find((p) => p.playerId === winnerId);
    this.lastWinnerUserId = winner?.userId ?? null;

    this.broadcaster.broadcast(this.roomKey, {
      type: 'match_end',
      payload: {
        winner: winner?.userId ?? null,
        history: this.engine.getRoundHistory(),
      },
    });

    if (this.players.length === 2) {
      this.gamification.recordGameResult({
        sessionId: this.identity.instanceId,
        guildId: this.identity.guildId,
        gameType: 'rock-paper-scissors',
        results: this.players.map((p) => ({
          userId: p.userId,
          position: p.playerId === winnerId ? 1 : 2,
        })),
      });
    }

    if (this.onSessionEnded) {
      this.onSessionEnded();
    }
  }

  private broadcastState() {
    const state = this.engine.getRoundState();
    this.broadcaster.broadcast(this.roomKey, {
      type: 'round_state',
      payload: state,
    });
  }

  pauseForDisconnect(userId: string, connection: unknown) {
    const player = this.players.find((p) => p.userId === userId);
    if (!player) return;
    player.connections.delete(connection);
    if (player.connections.size > 0) return;

    // Only 'multi' holds the slot open for a reconnect; single mode has no
    // opponent waiting, and a finished match has nothing left to hold open
    // (§6.2).
    if (this.identity.mode !== 'multi' || this.resultRecorded) {
      this.forceLeave(userId);
      return;
    }

    player.connected = false;
    this.broadcaster.broadcast(this.roomKey, {
      type: 'opponent_disconnected',
      payload: { player: player.playerId, timeoutMs: this.disconnectGraceMs },
    });
    this.disconnectGrace.arm(userId, this.disconnectGraceMs, () => {
      this.forceLeave(userId);
    });
  }

  leave(userId: string, connection: unknown) {
    const player = this.players.find((p) => p.userId === userId);
    if (!player) return;
    player.connections.delete(connection);
    if (player.connections.size > 0) return;

    this.disconnectGrace.disarm(userId);
    this.forceLeave(userId);
  }

  private forceLeave(userId: string) {
    this.disconnectGrace.disarm(userId);
    const player = this.players.find((p) => p.userId === userId);
    if (!player) return;

    const otherPlayer = this.players.find((p) => p.userId !== userId);
    if (otherPlayer && !this.resultRecorded) {
      this.endMatch(otherPlayer.playerId);
    }

    this.players = this.players.filter((p) => p.userId !== userId);
    if (this.players.length === 0) this.onSessionEnded?.();
  }

  getPublicConfig(): object {
    return {
      bestOf: this.engine.getRoundState().bestOf,
    };
  }

  getRoundState() {
    return this.engine.getRoundState();
  }

  getWinnerUserId(): string | null {
    return this.lastWinnerUserId;
  }

  // Unlike the other 5 queue-eligible games, RPS has no restart-vote flow at
  // all — without resetting the round here, a room would be permanently
  // stuck in "match ended" after the very first round, since nothing else
  // can ever start a new one.
  substitutePlayer(
    outgoingUserId: string,
    incomingUserId: string,
    connection: unknown,
  ): boolean {
    const outgoing = this.players.find((p) => p.userId === outgoingUserId);
    if (!outgoing) return false;

    this.players = this.players.filter((p) => p.userId !== outgoingUserId);
    this.players.push({
      userId: incomingUserId,
      playerId: outgoing.playerId,
      connected: true,
      connections: new Set([connection]),
    });

    this.engine = new RpsEngine({ bestOf: this.engine.getRoundState().bestOf });
    this.resultRecorded = false;
    this.lastWinnerUserId = null;
    this.broadcastState();
    return true;
  }

  // MANDATORY per §6.2: clears disconnect grace so it can't outlive a
  // disposed room.
  dispose(): void {
    this.clearBotTimer();
    this.disconnectGrace.clear();
  }
}
