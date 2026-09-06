import type { ActivityMode } from 'services/activity/gameId';
import type { ActivityBroadcaster } from 'services/activity/shared/ActivityBroadcaster';
import { getQuestions } from 'services/activity/trivia-quiz/questions';
import { TriviaQuizEngine } from 'services/activity/trivia-quiz/TriviaQuizEngine';
import type { TriviaQuizState } from 'services/activity/trivia-quiz/types';
import { GamificationService } from 'services/gamification';

export interface TriviaQuizSessionIdentity {
  sessionKey: string;
  instanceId: string;
  guildId: string;
  mode: ActivityMode;
}

interface TriviaQuizPlayer {
  userId: string;
  connected: boolean;
  connections: Set<unknown>;
}

export class TriviaQuizSession {
  private engine: TriviaQuizEngine;
  private players: TriviaQuizPlayer[] = [];
  private interval: ReturnType<typeof setInterval> | null = null;
  private resultRecorded = false;

  constructor(
    private identity: TriviaQuizSessionIdentity,
    private broadcaster: ActivityBroadcaster,
    private gamification: GamificationService = new GamificationService(),
  ) {
    this.engine = new TriviaQuizEngine(getQuestions());
  }

  addPlayer(userId: string, connection: unknown): boolean {
    const existing = this.players.find((p) => p.userId === userId);
    if (existing) {
      existing.connections.add(connection);
      if (!existing.connected) {
        existing.connected = true;
      }
      return true;
    }
    if (this.players.length >= 8) return false;

    try {
      this.engine.addPlayer(userId);
    } catch {
      return false;
    }

    this.players.push({
      userId,
      connected: true,
      connections: new Set([connection]),
    });

    this.broadcastState();
    return true;
  }

  handleAnswer(
    userId: string,
    answerIndex: number,
    submittedAtMs: number,
  ): void {
    const accepted = this.engine.submitAnswer(
      userId,
      answerIndex,
      submittedAtMs,
    );
    if (!accepted) return;

    this.broadcastState();
    this.checkAllAnswered();
  }

  // True when `connection` was the last socket holding the slot.
  private releaseConnection(
    player: TriviaQuizPlayer,
    connection: unknown,
  ): boolean {
    player.connections.delete(connection);
    return player.connections.size === 0;
  }

  // A dropped connection stops blocking `allAnswered` — otherwise a player
  // who leaves mid-question strands everyone else waiting on the timer
  // (§10 AP-5). Trivia has no per-player slot to forfeit (scores persist
  // regardless of connection), so both paths just mark presence.
  pauseForDisconnect(userId: string, connection: unknown): void {
    const player = this.players.find((p) => p.userId === userId);
    if (!player) return;
    if (!this.releaseConnection(player, connection)) return;

    player.connected = false;
    this.checkAllAnswered();
  }

  leave(userId: string, connection: unknown): void {
    this.pauseForDisconnect(userId, connection);
  }

  private checkAllAnswered(): void {
    const state = this.engine.getState();
    const connectedPlayers = this.players.filter((p) => p.connected);
    if (connectedPlayers.length === 0) return;

    const allAnswered = connectedPlayers.every((p) =>
      state.playerAnswers.has(p.userId),
    );
    if (allAnswered) {
      this.advanceToNextQuestion();
    }
  }

  tick(): void {
    const { questionEnded } = this.engine.tick(0);
    if (!questionEnded) return;

    this.advanceToNextQuestion();
  }

  private advanceToNextQuestion(): void {
    const hasNext = this.engine.advanceQuestion();
    if (hasNext) {
      this.broadcastState();
    } else {
      this.finishGame();
    }
  }

  private finishGame(): void {
    if (this.resultRecorded) return;
    this.resultRecorded = true;

    const leaderboard = this.engine.getLeaderboard();
    this.broadcast('game_end', { leaderboard });

    const results = leaderboard.map((entry, index) => ({
      userId: entry.userId,
      position: index + 1,
    }));

    this.gamification.recordGameResult({
      sessionId: this.identity.instanceId,
      guildId: this.identity.guildId,
      gameType: 'trivia-quiz',
      results,
    });

    if (this.interval) clearInterval(this.interval);
  }

  private broadcastState(): void {
    const state = this.engine.getState();
    const question = state.questions[state.currentQuestionIndex];

    if (!question) return;

    this.broadcast('state_update', {
      currentQuestionIndex: state.currentQuestionIndex,
      questionText: question.text,
      options: question.options,
      questionStartedAtMs: state.questionStartedAtMs,
      questionTimerMs: state.questionTimerMs,
      playerScores: Array.from(state.players.entries()).map(([, p]) => ({
        userId: p.userId,
        score: p.totalScore,
      })),
      finished: state.finished,
    });
  }

  private broadcast(type: string, payload: unknown): void {
    this.broadcaster.broadcast('trivia-quiz', {
      type,
      payload,
    });
  }

  start(): void {
    this.engine.startGame();
    this.broadcastState();

    this.interval = setInterval(() => {
      this.tick();
    }, 100);
  }

  getState(): TriviaQuizState {
    return this.engine.getState();
  }

  // Denormalized, wire-safe view of `getState().players` — that's a Map,
  // which serializes to `{}` over Colyseus's `client.send` (JSON has no Map
  // support), so the room's `init` payload must use this instead of the
  // raw state (§ the client showed "Players: 0/8" forever before this).
  getPublicPlayerScores(): { userId: string; score: number }[] {
    return Array.from(this.engine.getState().players.entries()).map(
      ([, p]) => ({ userId: p.userId, score: p.totalScore }),
    );
  }

  getLeaderboard(): { userId: string; score: number }[] {
    return this.engine.getLeaderboard();
  }

  dispose(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}
