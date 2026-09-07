import { Room, type Client } from 'colyseus';
import { HangmanSession } from 'services/activity/hangman/HangmanSession';
import { getHangmanWord } from 'services/activity/hangman/wordList';
import { roomKey } from 'services/activity/roomKey';
import type { ActivityBroadcaster } from 'services/activity/shared/ActivityBroadcaster';
import { RateLimiter } from 'services/activity/shared/RateLimiter';
import {
  verifyWsSessionToken,
  type WsSessionPayload,
} from 'services/activity/wsSessionToken';

const GUESS_RATE_LIMIT_WINDOW_MS = 1000;
const GUESS_RATE_LIMIT_MAX = 3;

export class HangmanRoom extends Room {
  private session!: HangmanSession;
  private guessRateLimiter = new RateLimiter({
    windowMs: GUESS_RATE_LIMIT_WINDOW_MS,
    max: GUESS_RATE_LIMIT_MAX,
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

    const word = getHangmanWord();

    this.session = new HangmanSession(
      {
        sessionKey: options.roomKey,
        instanceId: initialSession?.instanceId ?? '',
        guildId: initialSession?.guildId ?? '',
        mode: initialSession?.mode ?? 'multi',
      },
      broadcaster,
      undefined,
      word,
      { onSessionEnded: () => this.disconnect() },
    );

    this.onMessage('guess', (client, payload: { letter?: string }) => {
      if (this.guessRateLimiter.isOverLimit(client)) return;
      const auth = client.auth as WsSessionPayload;
      const result = this.session.guessLetter(
        auth.userId,
        payload?.letter ?? '',
      );
      if (!result.success) {
        client.send('guess_error', { message: result.message });
        return;
      }
      client.send('guess_success', {});
    });

    this.onMessage('leave', (client) => {
      const auth = client.auth as WsSessionPayload;
      this.session.pauseForDisconnect(auth.userId, client);
    });
  }

  override onJoin(client: Client, _options: unknown, auth: WsSessionPayload) {
    const added = this.session.addPlayer(auth.userId, client);
    if (!added) {
      client.leave(1008, 'Room is full');
      return;
    }

    const state = this.session.getState();
    client.send('init', state);
  }

  override onLeave(client: Client) {
    this.guessRateLimiter.clear(client);
    const auth = client.auth as WsSessionPayload;
    this.session.pauseForDisconnect(auth.userId, client);
  }

  override onDispose() {
    this.session.dispose();
  }
}
