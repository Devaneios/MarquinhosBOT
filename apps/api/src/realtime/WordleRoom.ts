import { Room, type Client } from 'colyseus';
import { roomKey } from 'services/activity/roomKey';
import { RateLimiter } from 'services/activity/shared/RateLimiter';
import {
  verifyWsSessionToken,
  type WsSessionPayload,
} from 'services/activity/wsSessionToken';
import { WordleService } from 'services/wordle';

const GUESS_RATE_LIMIT_WINDOW_MS = 1000;
const GUESS_RATE_LIMIT_MAX = 3;

export class WordleRoom extends Room {
  private service = new WordleService();
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

  override onCreate(options: { roomKey: string }) {
    void this.setMetadata({ roomKey: options.roomKey });

    this.onMessage('guess', (client, payload: { guess?: string }) => {
      const auth = client.auth as WsSessionPayload;
      if (this.guessRateLimiter.isOverLimit(client)) return;

      const result = this.service.submitGuess(
        auth.userId,
        auth.guildId,
        payload?.guess ?? '',
      );

      if ('error' in result) {
        client.send('guess_error', { message: result.error });
        return;
      }

      client.send('guess_result', result);
    });
  }

  override onJoin(client: Client, _options: unknown, auth: WsSessionPayload) {
    const daily = this.service.getDailyWord(auth.guildId);
    const session = this.service.getUserSession(auth.userId, auth.guildId);
    client.send('init', {
      wordLength: daily.word.length,
      guesses: session?.guesses ?? [],
      solved: session?.solved ?? false,
      attempts: session?.attempts ?? 0,
    });
  }

  override onLeave(client: Client) {
    this.guessRateLimiter.clear(client);
  }
}
