import { Room } from 'colyseus';
import { snakeInputPayloadSchema } from 'realtime/adapters/snakeAdapter';
import { requireAuth, type AuthedClient } from 'realtime/authedClient';
import { roomKey } from 'services/activity/roomKey';
import type { ActivityBroadcaster } from 'services/activity/shared/ActivityBroadcaster';
import { RateLimiter } from 'services/activity/shared/RateLimiter';
import { SnakeSession } from 'services/activity/snake-game/SnakeSession';
import {
  verifyWsSessionToken,
  type WsSessionPayload,
} from 'services/activity/wsSessionToken';

const INPUT_RATE_LIMIT_WINDOW_MS = 1000;
const INPUT_RATE_LIMIT_MAX = 60;

export class SnakeRoom extends Room<{ client: AuthedClient }> {
  private session!: SnakeSession;
  private inputRateLimiter = new RateLimiter({
    windowMs: INPUT_RATE_LIMIT_WINDOW_MS,
    max: INPUT_RATE_LIMIT_MAX,
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

    this.session = new SnakeSession(
      {
        sessionKey: options.roomKey,
        instanceId: initialSession?.instanceId ?? '',
        guildId: initialSession?.guildId ?? '',
        mode: initialSession?.mode ?? 'multi',
      },
      broadcaster,
      undefined,
      {
        width: 20,
        height: 20,
        initialSnakeLength: 3,
      },
      { onSessionEnded: () => this.disconnect() },
    );

    this.onMessage('input', (client: AuthedClient, payload: unknown) => {
      if (this.inputRateLimiter.isOverLimit(client)) return;
      const auth = requireAuth(client);
      const parsed = snakeInputPayloadSchema.safeParse(payload);
      if (!parsed.success) {
        client.send('input_error', { message: 'Invalid direction' });
        return;
      }
      this.session.handleInput(auth.userId, parsed.data.direction);
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
    const playerId = this.session.addPlayer(auth.userId, client);
    if (auth.mode === 'single') {
      this.session.enableBot();
    }
    client.send('init', {
      playerId,
      config: this.session.getPublicConfig(),
    });
  }

  override onLeave(client: AuthedClient) {
    this.inputRateLimiter.clear(client);
    const auth = requireAuth(client);
    this.session.pauseForDisconnect(auth.userId, client);
  }

  override onDispose() {
    this.session.dispose();
  }
}
