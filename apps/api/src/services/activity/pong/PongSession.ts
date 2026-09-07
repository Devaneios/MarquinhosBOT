import type { ActivityMode } from 'services/activity/gameId';
import {
  PongArenaEngine,
  type PongArenaEngineConfig,
} from 'services/activity/pong/PongArenaEngine';
import type { BotDifficulty } from 'services/activity/pong/PongBotAI';
import {
  PongCompetitionService,
  type PongRatingPool,
} from 'services/activity/pong/PongCompetitionService';
import {
  encodeStateSnapshot,
  PONG_PROTOCOL_VERSION,
} from 'services/activity/pong/pongProtocol';
import { getPongRuleset } from 'services/activity/pong/PongRulesetRegistry';
import type {
  PongInputState,
  PongRulesetId,
  PongSide,
} from 'services/activity/pong/PongTypes';
import type { BinaryActivityBroadcaster } from 'services/activity/shared/ActivityBroadcaster';
import { DisconnectGraceTimer } from 'services/activity/shared/DisconnectGraceTimer';
import { GamificationService } from 'services/gamification';

export type ActivityBroadcaster = BinaryActivityBroadcaster;

interface PongPlayer {
  userId: string;
  displayName: string;
  slot: number;
  side: PongSide;
  team: number;
  connected: boolean;
  ready: boolean;
  joinedAt: number;
  connections: Set<unknown>;
}

export interface PongSessionIdentity {
  sessionKey: string;
  instanceId: string;
  guildId: string;
  mode: ActivityMode;
}

export interface PongSessionEngineConfig extends Omit<
  PongArenaEngineConfig,
  'ruleset'
> {
  ruleset?: PongRulesetId;
  winningScore?: number;
}

export interface PongSessionOptions {
  onSessionEnded?: () => void;
  disconnectGraceMs?: number;
}

const FIXED_DT_MS = 1000 / 120;
const SNAPSHOT_DT_MS = 1000 / 25;
const MAX_CATCHUP_MS = 250;
const DEFAULT_DISCONNECT_GRACE_MS = 30_000;

export class PongSession {
  private engine: PongArenaEngine;
  private engineConfig: PongArenaEngineConfig;
  private players: PongPlayer[] = [];
  private spectators = new Set<string>();
  private interval: ReturnType<typeof setInterval> | null = null;
  private started = false;
  private resultRecorded = false;
  private botSlots = new Set<number>();
  private botDifficulty: BotDifficulty = 'normal';
  private botNextThinkMs = [0, 0, 0, 0];
  private localTwoPlayer = false;
  private restartVotes = new Set<string>();
  private snapshotSeq = 0;
  private lastInputSeq = [0, 0, 0, 0];
  private hasInputSeq = [false, false, false, false];
  private lastLoopHr: bigint | null = null;
  private accumulatorMs = 0;
  private snapshotAccumulatorMs = 0;
  private simulationTimeMs = 0;
  private disconnectGrace = new DisconnectGraceTimer<string>();
  private hostUserId: string | null = null;
  private competition = new PongCompetitionService();
  private readonly onSessionEnded?: () => void;
  private readonly disconnectGraceMs: number;

  constructor(
    private identity: PongSessionIdentity,
    private broadcaster: ActivityBroadcaster,
    private gamification: GamificationService = new GamificationService(),
    config: PongSessionEngineConfig = {},
    options: PongSessionOptions = {},
  ) {
    this.engineConfig = {
      ...config,
      ruleset: config.ruleset ?? 'classic-1v1',
      ...(config.winningScore !== undefined
        ? { targetScore: config.winningScore }
        : {}),
    };
    this.engine = new PongArenaEngine(this.engineConfig);
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

  addPlayer(
    userId: string,
    connection: unknown,
    displayName = userId,
    announce = true,
  ): PongSide | null {
    const existing = this.players.find((player) => player.userId === userId);
    if (existing) {
      existing.connections.add(connection);
      if (!existing.connected) this.resumeExisting(existing);
      return existing.side;
    }
    const definition = getPongRuleset(this.engine.getConfig().ruleset);
    if (this.players.length >= definition.maxPlayers || this.started) {
      this.spectators.add(userId);
      return null;
    }
    const slot = this.firstOpenSlot(definition.maxPlayers);
    const paddle = this.engine
      .getState()
      .paddles.find((candidate) => candidate.slot === slot);
    if (!paddle) {
      this.spectators.add(userId);
      return null;
    }
    const player: PongPlayer = {
      userId,
      displayName,
      slot,
      side: paddle.side,
      team: paddle.team,
      connected: true,
      ready: this.identity.mode !== 'multi',
      joinedAt: Date.now(),
      connections: new Set([connection]),
    };
    this.players.push(player);
    this.hostUserId ??= userId;
    if (announce) this.broadcastLobby();
    return player.side;
  }

  publishLobby(): void {
    this.broadcastLobby();
  }

  getAssignment(userId: string) {
    const player = this.players.find(
      (candidate) => candidate.userId === userId,
    );
    return player
      ? { slot: player.slot, side: player.side, team: player.team }
      : null;
  }

  setReady(userId: string, ready: boolean): void {
    const player = this.players.find(
      (candidate) => candidate.userId === userId,
    );
    if (!player || this.started) return;
    player.ready = ready;
    this.broadcastLobby();
    if (this.canStart()) this.start();
  }

  configure(userId: string, config: Partial<PongArenaEngineConfig>): void {
    if (userId !== this.hostUserId || this.started) return;
    const ruleset = config.ruleset ?? this.engineConfig.ruleset;
    const nextConfig = {
      ...this.engineConfig,
      ...config,
      ruleset,
      ...(ruleset && getPongRuleset(ruleset).rankedPool === null
        ? { ranked: false }
        : {}),
    };
    const nextEngine = new PongArenaEngine(nextConfig);
    const definition = getPongRuleset(nextEngine.getConfig().ruleset);
    const retained = this.players
      .sort((a, b) => a.joinedAt - b.joinedAt)
      .slice(0, definition.maxPlayers);
    const paddles = nextEngine.getState().paddles;
    for (let slot = 0; slot < retained.length; slot += 1) {
      const paddle = paddles.find((candidate) => candidate.slot === slot);
      if (!paddle) break;
      retained[slot]!.slot = slot;
      retained[slot]!.side = paddle.side;
      retained[slot]!.team = paddle.team;
      retained[slot]!.ready = false;
    }
    for (const player of this.players.slice(definition.maxPlayers)) {
      this.spectators.add(player.userId);
    }
    this.engineConfig = nextConfig;
    this.engine = nextEngine;
    this.players = retained;
    this.lastInputSeq.fill(0);
    this.hasInputSeq.fill(false);
    this.broadcastLobby();
  }

  getLobbyState() {
    return {
      hostUserId: this.hostUserId,
      started: this.started,
      config: this.engine.getConfig(),
      players: this.players.map((player) => ({
        userId: player.userId,
        displayName: player.displayName,
        slot: player.slot,
        side: player.side,
        team: player.team,
        connected: player.connected,
        ready: player.ready,
      })),
      spectators: [...this.spectators],
    };
  }

  private firstOpenSlot(maxPlayers: number): number {
    for (let slot = 0; slot < maxPlayers; slot += 1) {
      if (!this.players.some((player) => player.slot === slot)) return slot;
    }
    return maxPlayers;
  }

  private canStart(): boolean {
    const definition = getPongRuleset(this.engine.getConfig().ruleset);
    const occupied = this.players.length + this.botSlots.size;
    return (
      occupied >= definition.minPlayers &&
      this.players.every((player) => player.connected && player.ready)
    );
  }

  private broadcastLobby(): void {
    this.broadcaster.broadcast(this.roomKey, {
      type: 'lobby_state',
      payload: this.getLobbyState(),
    });
  }

  private releaseConnection(player: PongPlayer, connection: unknown): boolean {
    player.connections.delete(connection);
    return player.connections.size === 0;
  }

  private resumeExisting(player: PongPlayer): void {
    player.connected = true;
    this.disconnectGrace.disarm(player.userId);
    if (
      this.started &&
      this.players.every((candidate) => candidate.connected)
    ) {
      this.startLoop();
    }
    this.broadcaster.broadcast(this.roomKey, {
      type: 'player_reconnected',
      payload: { slot: player.slot, side: player.side },
    });
    this.broadcastLobby();
  }

  pauseForDisconnect(userId: string, connection: unknown): void {
    const player = this.players.find(
      (candidate) => candidate.userId === userId,
    );
    if (!player) {
      this.spectators.delete(userId);
      return;
    }
    if (!this.releaseConnection(player, connection)) return;
    const state = this.engine.getState();
    if (this.identity.mode !== 'multi' || state.phase === 'series-over') {
      this.detach(userId);
      return;
    }
    if (!player.connected) return;
    player.connected = false;
    if (this.started) this.stopLoop();
    this.broadcaster.broadcast(this.roomKey, {
      type: 'player_disconnected',
      payload: {
        slot: player.slot,
        side: player.side,
        timeoutMs: this.disconnectGraceMs,
      },
    });
    this.broadcastLobby();
    this.disconnectGrace.arm(userId, this.disconnectGraceMs, () =>
      this.forfeitDisconnected(userId),
    );
  }

  private forfeitDisconnected(userId: string): void {
    const player = this.players.find(
      (candidate) => candidate.userId === userId,
    );
    if (!player || player.connected) return;
    if (
      this.engine.getConfig().ruleset === 'quad-elimination' ||
      this.engine.getConfig().ruleset === 'air-hockey'
    ) {
      this.engine.setSlotActive(player.slot, false);
      this.removePlayer(userId);
      if (this.players.some((candidate) => candidate.connected))
        this.startLoop();
      return;
    }
    this.forfeitTo(userId);
    this.removePlayer(userId);
  }

  private detach(userId: string): void {
    this.disconnectGrace.disarm(userId);
    if (this.started) this.forfeitTo(userId);
    this.removePlayer(userId);
  }

  private forfeitTo(userId: string): void {
    const remaining = this.players.find(
      (player) => player.userId !== userId && player.connected,
    );
    if (!remaining || this.engine.getState().winnerSlot !== null) return;
    this.engine.forceWinner(remaining.slot);
    const state = this.broadcastSnapshot();
    this.stopLoop();
    if (!this.resultRecorded) {
      this.resultRecorded = true;
      this.recordResult(state.winnerSlot!);
    }
  }

  private removePlayer(userId: string): void {
    this.players = this.players.filter((player) => player.userId !== userId);
    this.restartVotes.delete(userId);
    this.spectators.delete(userId);
    if (this.hostUserId === userId) {
      this.hostUserId =
        [...this.players].sort((a, b) => a.joinedAt - b.joinedAt)[0]?.userId ??
        null;
    }
    if (this.players.length === 0) {
      this.stopLoop();
      this.onSessionEnded?.();
    }
    this.broadcastLobby();
  }

  leave(userId: string, connection: unknown): void {
    const player = this.players.find(
      (candidate) => candidate.userId === userId,
    );
    if (!player) {
      this.spectators.delete(userId);
      return;
    }
    if (!this.releaseConnection(player, connection)) return;
    this.detach(userId);
  }

  handleInput(
    userId: string,
    direction: -1 | 0 | 1,
    seq = 0,
    side?: PongSide,
    target?: number,
    release = false,
  ): void {
    const player = this.players.find(
      (candidate) => candidate.userId === userId,
    );
    if (!player || !this.started) return;
    let slot = player.slot;
    let controlledSlots = [slot];
    if (this.localTwoPlayer && side !== undefined) {
      const state = this.engine.getState();
      slot =
        state.paddles.find((paddle) => paddle.side === side)?.slot ??
        (side === 'right' ? 1 : 0);
      controlledSlots = [
        ...new Set(
          state.paddles
            .filter((paddle) => paddle.side === side || paddle.slot === slot)
            .map((paddle) => paddle.slot),
        ),
      ];
    }
    if (this.hasInputSeq[slot] && seq <= (this.lastInputSeq[slot] ?? 0)) return;
    const input: PongInputState = {
      axis: direction,
      target:
        target === undefined || !Number.isFinite(target)
          ? null
          : Math.min(Math.max(target, 0), 1),
      release,
    };
    for (const controlledSlot of controlledSlots) {
      this.engine.setInput(controlledSlot, input);
      this.lastInputSeq[controlledSlot] = seq;
      this.hasInputSeq[controlledSlot] = true;
    }
  }

  enableLocalTwoPlayer(): void {
    this.localTwoPlayer = true;
    const ruleset = this.engine.getConfig().ruleset;
    if (
      ruleset === 'quad-elimination' ||
      ruleset === 'air-hockey' ||
      ruleset === 'coop-keep-alive'
    ) {
      this.botSlots.add(2);
      this.botSlots.add(3);
    }
  }

  enableBot(humanSide?: PongSide, difficulty: BotDifficulty = 'normal'): void {
    this.botDifficulty = difficulty;
    const humanSlot = humanSide
      ? this.engine
          .getState()
          .paddles.find((paddle) => paddle.side === humanSide)?.slot
      : this.players[0]?.slot;
    for (const paddle of this.engine.getState().paddles) {
      if (paddle.slot !== humanSlot) this.botSlots.add(paddle.slot);
    }
  }

  getPublicConfig() {
    const config = this.engine.getConfig();
    return {
      width: config.width,
      height: config.height,
      paddleWidth: 12,
      paddleHeight: 80,
      paddleSpeed: config.paddleSpeed,
      ballRadius: 8,
      cornerGap: config.cornerGap,
      protocolVersion: PONG_PROTOCOL_VERSION,
      ruleset: config.ruleset,
      arena: getPongRuleset(config.ruleset).arena,
      targetScore: config.targetScore,
      bestOf: config.bestOf,
    };
  }

  requestRestart(userId: string): void {
    if (this.engine.getState().phase !== 'series-over') return;
    if (!this.players.some((player) => player.userId === userId)) return;
    this.restartVotes.add(userId);
    const required = this.botSlots.size > 0 ? 1 : this.players.length;
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
    this.engine.begin();
    this.lastInputSeq.fill(0);
    this.hasInputSeq.fill(false);
    this.started = true;
    this.startLoop();
    this.broadcastSnapshot();
  }

  start(): void {
    if (!this.started) this.engine.begin();
    this.started = true;
    for (const player of this.players) player.ready = true;
    this.broadcastLobby();
    this.startLoop();
  }

  stop(): void {
    this.stopLoop();
  }

  private startLoop(): void {
    if (this.interval) return;
    this.lastLoopHr = process.hrtime.bigint();
    this.accumulatorMs = 0;
    this.snapshotAccumulatorMs = 0;
    this.interval = setInterval(() => this.loop(), FIXED_DT_MS);
  }

  private stopLoop(): void {
    if (!this.interval) return;
    clearInterval(this.interval);
    this.interval = null;
  }

  private loop(): void {
    const now = process.hrtime.bigint();
    const elapsedMs = Number(now - (this.lastLoopHr ?? now)) / 1e6;
    this.lastLoopHr = now;
    this.accumulatorMs = Math.min(
      this.accumulatorMs + elapsedMs,
      MAX_CATCHUP_MS,
    );
    while (this.accumulatorMs >= FIXED_DT_MS) {
      this.simulateStep();
      this.accumulatorMs -= FIXED_DT_MS;
      this.snapshotAccumulatorMs += FIXED_DT_MS;
      if (this.snapshotAccumulatorMs >= SNAPSHOT_DT_MS) {
        this.snapshotAccumulatorMs %= SNAPSHOT_DT_MS;
        this.broadcastSnapshot();
      }
      if (!this.interval) return;
    }
  }

  tick(): void {
    this.simulateStep();
    this.broadcastSnapshot();
  }

  private simulateStep(): void {
    this.updateBots();
    this.engine.tick(FIXED_DT_MS);
    this.simulationTimeMs += FIXED_DT_MS;
    for (const event of this.engine.consumeEvents()) {
      this.broadcaster.broadcast(this.roomKey, {
        type: event.type.replaceAll('-', '_'),
        payload: event,
      });
    }
    const state = this.engine.getState();
    if (state.phase === 'series-over' && !this.resultRecorded) {
      this.resultRecorded = true;
      if (state.winnerSlot !== null) this.recordResult(state.winnerSlot);
      this.stopLoop();
    }
  }

  private updateBots(): void {
    const state = this.engine.getState();
    const ball = state.balls.find((candidate) => candidate.active);
    if (!ball) return;
    const reactionMs =
      this.botDifficulty === 'easy'
        ? 450
        : this.botDifficulty === 'normal'
          ? 220
          : 100;
    const aimError =
      this.botDifficulty === 'easy'
        ? 36
        : this.botDifficulty === 'normal'
          ? 12
          : 0;
    for (const slot of this.botSlots) {
      const paddle = state.paddles.find((candidate) => candidate.slot === slot);
      if (!paddle) continue;
      if (this.simulationTimeMs < (this.botNextThinkMs[slot] ?? 0)) continue;
      this.botNextThinkMs[slot] = this.simulationTimeMs + reactionMs;
      const boundary =
        paddle.orientation === 'vertical' ? state.height : state.width;
      let coordinate = paddle.orientation === 'vertical' ? ball.y : ball.x;
      if (paddle.orientation === 'vertical' && ball.vx !== 0) {
        const time = (paddle.x - ball.x) / ball.vx;
        if (time > 0)
          coordinate = this.reflect(
            ball.y + ball.vy * time,
            8,
            state.height - 8,
          );
      } else if (paddle.orientation === 'horizontal' && ball.vy !== 0) {
        const time = (paddle.y - ball.y) / ball.vy;
        if (time > 0)
          coordinate = this.reflect(
            ball.x + ball.vx * time,
            8,
            state.width - 8,
          );
      }
      coordinate +=
        Math.sin(this.simulationTimeMs * 0.013 + slot * 2.7) * aimError;
      const target = Math.min(Math.max(coordinate / boundary, 0), 1);
      this.engine.setInput(slot, { axis: 0, target, release: false });
    }
  }

  private reflect(value: number, min: number, max: number): number {
    const span = max - min;
    const period = span * 2;
    let normalized = (value - min) % period;
    if (normalized < 0) normalized += period;
    return min + (normalized <= span ? normalized : period - normalized);
  }

  private broadcastSnapshot() {
    const state = this.engine.getState();
    this.snapshotSeq += 1;
    this.broadcaster.broadcastBinary(
      this.roomKey,
      encodeStateSnapshot({
        seq: this.snapshotSeq,
        serverTimeMs: Math.floor(this.simulationTimeMs),
        phase: this.started ? state.phase : 'lobby',
        phaseRemainingMs: state.phaseRemainingMs,
        ruleset: state.ruleset,
        arena: state.arena,
        targetScore: this.engine.getConfig().targetScore,
        bestOf: this.engine.getConfig().bestOf,
        gameIndex: state.gameIndex,
        winnerSlot: state.winnerSlot,
        lastEventSeq: state.lastEventSeq,
        acks: [...this.lastInputSeq],
        score: state.score,
        gamesWon: state.gamesWon,
        lives: state.lives,
        paddles: state.paddles,
        balls: state.balls,
        bricks: state.bricks,
        powerUps: state.powerUps,
      }),
    );
    return state;
  }

  private recordResult(winnerSlot: number): void {
    if (this.players.length < 2 || this.identity.mode !== 'multi') return;
    const state = this.engine.getState();
    const winnerTeam = state.paddles.find(
      (paddle) => paddle.slot === winnerSlot,
    )?.team;
    const results = this.players.map((player) => ({
      userId: player.userId,
      position:
        state.placements[player.slot] || (player.team === winnerTeam ? 1 : 2),
    }));
    this.gamification.recordGameResult({
      sessionId: this.identity.instanceId,
      guildId: this.identity.guildId,
      gameType: 'pong',
      results,
    });
    const config = this.engine.getConfig();
    if (config.ranked && getPongRuleset(config.ruleset).rankedPool) {
      this.competition.recordMatch(
        this.identity.instanceId,
        this.identity.guildId,
        config.ruleset as PongRatingPool,
        results,
      );
    }
  }

  dispose(): void {
    this.stopLoop();
    this.disconnectGrace.clear();
  }
}
