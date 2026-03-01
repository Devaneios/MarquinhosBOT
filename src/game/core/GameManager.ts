import { MarquinhosApiService } from '@marquinhos/services/marquinhosApi';
import { Collection } from 'discord.js';
import { v4 as uuidv4 } from 'uuid';
import {
  BaseGame,
  GAME_CONFIGS,
  GAME_COOLDOWNS,
  GameResult,
  GameSession,
  GameState,
  GameType,
} from './GameTypes';

const apiService = new MarquinhosApiService();

export class GameManager {
  private static instance: GameManager;
  private activeSessions: Collection<string, GameSession> = new Collection();
  private playerCooldowns: Collection<string, Map<GameType, number>> =
    new Collection();
  private gameInstances: Collection<string, BaseGame> = new Collection();

  private constructor() {
    // Cleanup expired sessions every minute
    setInterval(() => this.cleanupExpiredSessions(), 60000);
  }

  public static getInstance(): GameManager {
    if (!GameManager.instance) {
      GameManager.instance = new GameManager();
    }
    return GameManager.instance;
  }

  public createSession(
    gameType: GameType,
    guildId: string,
    channelId: string,
    hostId: string,
    options?: any,
  ): GameSession {
    const config = { ...GAME_CONFIGS[gameType], options };
    const sessionId = uuidv4();

    const session: GameSession = {
      id: sessionId,
      type: gameType,
      guildId,
      channelId,
      hostId,
      players: [],
      state: GameState.WAITING,
      startedAt: new Date(),
      expiresAt: new Date(Date.now() + (config.timeLimit || 300) * 1000),
      config,
      data: {},
      round: 1,
    };

    this.activeSessions.set(sessionId, session);
    return session;
  }

  public getSession(sessionId: string): GameSession | undefined {
    return this.activeSessions.get(sessionId);
  }

  public getSessionByChannel(channelId: string): GameSession | undefined {
    return this.activeSessions.find(
      (session) => session.channelId === channelId,
    );
  }

  public getPlayerSession(
    userId: string,
    guildId: string,
  ): GameSession | undefined {
    return this.activeSessions.find(
      (session) =>
        session.guildId === guildId &&
        session.players.some((player) => player.userId === userId),
    );
  }

  public endSession(sessionId: string): boolean {
    const session = this.activeSessions.get(sessionId);
    if (!session) return false;

    session.state = GameState.FINISHED;
    this.activeSessions.delete(sessionId);
    this.gameInstances.delete(sessionId);

    return true;
  }

  public async endSessionWithResult(sessionId: string, result: GameResult): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    const results = [
      ...result.winners.map((userId, idx) => ({ userId, position: idx + 1 })),
      ...result.losers.map((userId, idx) => ({ userId, position: result.winners.length + idx + 1 })),
    ];

    try {
      await apiService.postGameResult({
        sessionId,
        guildId: session.guildId,
        gameType: session.type,
        durationMs: result.duration,
        results,
      });
    } catch (error) {
      console.error('Failed to post game result:', error);
    }

    this.endSession(sessionId);
  }

  public registerGameInstance(sessionId: string, gameInstance: BaseGame): void {
    this.gameInstances.set(sessionId, gameInstance);
  }

  public getGameInstance(sessionId: string): BaseGame | undefined {
    return this.gameInstances.get(sessionId);
  }

  public canUserPlay(userId: string, gameType: GameType): boolean {
    const userCooldowns = this.playerCooldowns.get(userId);
    if (!userCooldowns) return true;

    const lastPlayed = userCooldowns.get(gameType);
    if (!lastPlayed) return true;

    const cooldownTime = GAME_COOLDOWNS[gameType] * 1000;
    return Date.now() - lastPlayed >= cooldownTime;
  }

  public setUserCooldown(userId: string, gameType: GameType): void {
    let userCooldowns = this.playerCooldowns.get(userId);
    if (!userCooldowns) {
      userCooldowns = new Map();
      this.playerCooldowns.set(userId, userCooldowns);
    }

    userCooldowns.set(gameType, Date.now());
  }

  public getUserCooldownRemaining(userId: string, gameType: GameType): number {
    const userCooldowns = this.playerCooldowns.get(userId);
    if (!userCooldowns) return 0;

    const lastPlayed = userCooldowns.get(gameType);
    if (!lastPlayed) return 0;

    const cooldownTime = GAME_COOLDOWNS[gameType] * 1000;
    const remaining = cooldownTime - (Date.now() - lastPlayed);

    return Math.max(0, Math.ceil(remaining / 1000));
  }

  public getActiveSessionsCount(): number {
    return this.activeSessions.size;
  }

  public getActiveSessionsByGuild(guildId: string): GameSession[] {
    return [
      ...this.activeSessions
        .filter((session) => session.guildId === guildId)
        .values(),
    ];
  }

  public getSessionStats(sessionId: string): any {
    const session = this.getSession(sessionId);
    if (!session) return null;

    return {
      id: session.id,
      type: session.type,
      state: session.state,
      players: session.players.length,
      duration: Date.now() - session.startedAt.getTime(),
      round: session.round,
    };
  }

  private cleanupExpiredSessions(): void {
    const now = new Date();
    const expiredSessions = this.activeSessions.filter(
      (session) =>
        session.expiresAt < now || session.state === GameState.FINISHED,
    );

    expiredSessions.forEach((session) => {
      this.endSession(session.id);
    });

    // Also cleanup old cooldowns (older than 24 hours)
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    this.playerCooldowns.forEach((userCooldowns, userId) => {
      userCooldowns.forEach((timestamp, gameType) => {
        if (timestamp < oneDayAgo) {
          userCooldowns.delete(gameType);
        }
      });

      if (userCooldowns.size === 0) {
        this.playerCooldowns.delete(userId);
      }
    });
  }

  public forceCleanup(): void {
    this.cleanupExpiredSessions();
  }

  // Debug methods
  public debugInfo(): any {
    return {
      activeSessions: this.activeSessions.size,
      gameInstances: this.gameInstances.size,
      playersWithCooldowns: this.playerCooldowns.size,
      sessions: this.activeSessions.map((s) => ({
        id: s.id,
        type: s.type,
        state: s.state,
        players: s.players.length,
        guild: s.guildId,
        channel: s.channelId,
      })),
    };
  }
}
