import { Room, type Client } from 'colyseus';
import { roomKey } from 'services/activity/roomKey';
import type { ActivityBroadcaster } from 'services/activity/shared/ActivityBroadcaster';
import { RateLimiter } from 'services/activity/shared/RateLimiter';
import { TriviaQuizSession } from 'services/activity/trivia-quiz/TriviaQuizSession';
import {
  verifyWsSessionToken,
  type WsSessionPayload,
} from 'services/activity/wsSessionToken';
import { GamificationService } from 'services/gamification/GamificationService';

const ANSWER_RATE_LIMIT_WINDOW_MS = 1000;
const ANSWER_RATE_LIMIT_MAX = 1;

export class TriviaQuizRoom extends Room {
  private session!: TriviaQuizSession;
  private answerRateLimiter = new RateLimiter({
    windowMs: ANSWER_RATE_LIMIT_WINDOW_MS,
    max: ANSWER_RATE_LIMIT_MAX,
  });

  override async onAuth(
    _client: Client,
    options: { token?: string; roomKey?: string },
  ): Promise<WsSessionPayload> {
    const session = options.token ? verifyWsSessionToken(options.token) : null;
    if (!session) throw new Error('Invalid or expired session token');
    if (roomKey(session) !== options.roomKey) {
      throw new Error('Room key does not match session identity');
    }
    return session;
  }

  override onCreate(options: { roomKey: string; token?: string }) {
    void this.setMetadata({ roomKey: options.roomKey });

    const initialSession = options.token
      ? verifyWsSessionToken(options.token)
      : null;

    const broadcaster: ActivityBroadcaster = {
      broadcast: (_key, message) => {
        this.broadcast(message.type, message.payload);
      },
    };

    this.session = new TriviaQuizSession(
      {
        sessionKey: options.roomKey,
        instanceId: initialSession?.instanceId ?? '',
        guildId: initialSession?.guildId ?? '',
        mode: initialSession?.mode ?? 'multi',
      },
      broadcaster,
      new GamificationService(),
    );

    this.onMessage('answer', (client, payload: { answerIndex?: number }) => {
      if (this.answerRateLimiter.isOverLimit(client)) return;
      const auth = client.auth as WsSessionPayload;

      const answerIndex = payload?.answerIndex ?? -1;
      if (answerIndex < 0 || typeof answerIndex !== 'number') return;

      this.session.handleAnswer(auth.userId, answerIndex, Date.now());
    });
  }

  override onJoin(client: Client, _options: unknown, auth: WsSessionPayload) {
    const joined = this.session.addPlayer(auth.userId, client);
    if (!joined) {
      client.send('error', { message: 'Game is full' });
      client.leave();
      return;
    }

    client.send('init', {
      playerScores: this.session.getPublicPlayerScores(),
      leaderboard: this.session.getLeaderboard(),
    });

    if (this.session.getState().players.size === 2) {
      this.session.start();
    }
  }

  override onLeave(client: Client) {
    this.answerRateLimiter.clear(client);
    const auth = client.auth as WsSessionPayload;
    this.session.pauseForDisconnect(auth.userId, client);
  }

  override onDispose() {
    this.session.dispose();
  }
}
