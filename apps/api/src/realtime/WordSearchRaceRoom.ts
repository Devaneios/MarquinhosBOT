import { Room } from 'colyseus';
import { selectPayloadSchema } from 'realtime/adapters/wordSearchRaceAdapter';
import { requireAuth, type AuthedClient } from 'realtime/authedClient';
import { roomKey } from 'services/activity/roomKey';
import type { ActivityBroadcaster } from 'services/activity/shared/ActivityBroadcaster';
import { RateLimiter } from 'services/activity/shared/RateLimiter';
import { WordSearchRaceSession } from 'services/activity/word-search-race/WordSearchRaceSession';
import {
  verifyWsSessionToken,
  type WsSessionPayload,
} from 'services/activity/wsSessionToken';

const SELECT_RATE_LIMIT_WINDOW_MS = 1000;
const SELECT_RATE_LIMIT_MAX = 10;

export class WordSearchRaceRoom extends Room<{ client: AuthedClient }> {
  private session!: WordSearchRaceSession;
  private selectRateLimiter = new RateLimiter({
    windowMs: SELECT_RATE_LIMIT_WINDOW_MS,
    max: SELECT_RATE_LIMIT_MAX,
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

    const broadcaster: ActivityBroadcaster = {
      broadcast: (_key, message) => {
        this.broadcast(message.type, message.payload);
      },
    };

    this.session = new WordSearchRaceSession(
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

    this.onMessage('select', (client: AuthedClient, payload: unknown) => {
      if (this.selectRateLimiter.isOverLimit(client)) return;
      const parsed = selectPayloadSchema.safeParse(payload);
      if (!parsed.success) {
        client.send('select_error', { message: 'Invalid selection' });
        return;
      }

      const auth = requireAuth(client);
      const result = this.session.submitSelection(
        auth.userId,
        parsed.data.start,
        parsed.data.end,
      );

      if ('error' in result) {
        client.send('select_error', { message: result.error });
      }
    });

    this.onMessage('leave', (client: AuthedClient) => {
      const auth = requireAuth(client);
      this.session.removePlayer(auth.userId, client);
    });
  }

  override onJoin(
    client: AuthedClient,
    _options: unknown,
    auth: WsSessionPayload,
  ) {
    this.session.addPlayer(auth.userId, client);
    client.send('init', this.session.getPublicState());
  }

  override onLeave(client: AuthedClient) {
    this.selectRateLimiter.clear(client);
    const auth = requireAuth(client);
    this.session.removePlayer(auth.userId, client);
  }

  override onDispose() {
    this.session.dispose();
  }
}
