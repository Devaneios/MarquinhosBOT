import { Room } from 'colyseus';
import { submitWordPayloadSchema } from 'realtime/adapters/boggleAdapter';
import { requireAuth, type AuthedClient } from 'realtime/authedClient';
import { BoggleSession } from 'services/activity/boggle/BoggleSession';
import { roomKey } from 'services/activity/roomKey';
import type { ActivityBroadcaster } from 'services/activity/shared/ActivityBroadcaster';
import { RateLimiter } from 'services/activity/shared/RateLimiter';
import {
  verifyWsSessionToken,
  type WsSessionPayload,
} from 'services/activity/wsSessionToken';

const SUBMIT_RATE_LIMIT_WINDOW_MS = 1000;
const SUBMIT_RATE_LIMIT_MAX = 10;

export class BoggleRoom extends Room<{ client: AuthedClient }> {
  private session!: BoggleSession;
  private submitRateLimiter = new RateLimiter({
    windowMs: SUBMIT_RATE_LIMIT_WINDOW_MS,
    max: SUBMIT_RATE_LIMIT_MAX,
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

    this.session = new BoggleSession(
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

    this.onMessage('submit_word', (client: AuthedClient, payload: unknown) => {
      if (this.submitRateLimiter.isOverLimit(client)) return;
      const parsed = submitWordPayloadSchema.safeParse(payload);
      if (!parsed.success) {
        client.send('submit_error', { message: 'Invalid path' });
        return;
      }

      const auth = requireAuth(client);
      const result = this.session.submitWord(auth.userId, parsed.data.path);
      if (!result.accepted) {
        client.send('submit_error', { reason: result.reason });
      }
    });

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
    client.send('init', {
      grid: this.session.getPublicGrid(),
      state: this.session.getState(),
    });
  }

  override onLeave(client: AuthedClient) {
    this.submitRateLimiter.clear(client);
    const auth = requireAuth(client);
    this.session.pauseForDisconnect(auth.userId, client);
  }

  override onDispose() {
    this.session?.dispose();
  }
}
