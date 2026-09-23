import { roomKey } from '@marquinhos/domain/activity/roomKey';
import { Room } from 'colyseus';
import { requireAuth, type AuthedClient } from 'realtime/authedClient';
import { ACTION_REJECTED } from 'services/activity/shared/ActionResult';
import { RateLimiter } from 'services/activity/shared/RateLimiter';
import { WordleRaceSession } from 'services/activity/wordle-race/WordleRaceSession';
import {
  verifyWsSessionToken,
  type WsSessionPayload,
} from 'services/activity/wsSessionToken';

const GUESS_RATE_LIMIT_WINDOW_MS = 1000;
const GUESS_RATE_LIMIT_MAX = 3;

export class WordleRaceRoom extends Room<{ client: AuthedClient }> {
  private session!: WordleRaceSession;
  private guessRateLimiter = new RateLimiter({
    windowMs: GUESS_RATE_LIMIT_WINDOW_MS,
    max: GUESS_RATE_LIMIT_MAX,
  });

  override async onAuth(
    _client: AuthedClient,
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

    const broadcaster = {
      broadcast: (
        _key: string,
        message: { type: string; payload?: unknown },
      ) => {
        this.broadcast(message.type, message.payload);
      },
    };

    this.session = new WordleRaceSession(
      {
        sessionKey: options.roomKey,
        instanceId: initialSession?.instanceId ?? '',
        guildId: initialSession?.guildId ?? '',
        mode: initialSession?.mode ?? 'multi',
      },
      broadcaster,
      undefined,
      { onSessionEnded: () => this.disconnect() },
    );

    this.onMessage(
      'guess',
      (client: AuthedClient, payload: { guess?: string }) => {
        if (this.guessRateLimiter.isOverLimit(client)) return;
        const auth = requireAuth(client);
        const result = this.session.submitGuess(
          auth.userId,
          payload?.guess ?? '',
        );
        if (!result.ok) {
          client.send(ACTION_REJECTED, { error: result.error });
        }
      },
    );

    this.onMessage('leave', (client: AuthedClient) => {
      const auth = requireAuth(client);
      this.session.leave(auth.userId, client);
    });
  }

  override onJoin(
    client: AuthedClient,
    _options: unknown,
    auth: WsSessionPayload,
  ) {
    this.session.addPlayer(auth.userId, client);
    const gameState = this.session.getGameState(auth.userId);
    client.send('init', gameState);
  }

  override onLeave(client: AuthedClient) {
    this.guessRateLimiter.clear(client);
    const auth = requireAuth(client);
    this.session.pauseForDisconnect(auth.userId, client);
  }

  override onDispose() {
    this.session.dispose();
  }
}
