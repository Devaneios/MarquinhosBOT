import { Room } from 'colyseus';
import { checkersMovePayloadSchema } from 'realtime/adapters/checkersAdapter';
import { requireAuth, type AuthedClient } from 'realtime/authedClient';
import type { Color } from 'services/activity/checkers/CheckersEngine';
import { CheckersSession } from 'services/activity/checkers/CheckersSession';
import { roomKey } from 'services/activity/roomKey';
import { ACTION_REJECTED } from 'services/activity/shared/ActionResult';
import type { ActivityBroadcaster } from 'services/activity/shared/ActivityBroadcaster';
import { RateLimiter } from 'services/activity/shared/RateLimiter';
import {
  verifyWsSessionToken,
  type WsSessionPayload,
} from 'services/activity/wsSessionToken';

const MOVE_RATE_LIMIT_WINDOW_MS = 1000;
const MOVE_RATE_LIMIT_MAX = 10;

export class CheckersRoom extends Room<{ client: AuthedClient }> {
  private session!: CheckersSession;
  private moveRateLimiter = new RateLimiter({
    windowMs: MOVE_RATE_LIMIT_WINDOW_MS,
    max: MOVE_RATE_LIMIT_MAX,
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

    this.session = new CheckersSession(
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

    this.onMessage('move', (client: AuthedClient, payload: unknown) => {
      if (this.moveRateLimiter.isOverLimit(client)) return;
      const parsed = checkersMovePayloadSchema.safeParse(payload);
      if (!parsed.success) return;

      const auth = requireAuth(client);
      const result = this.session.requestMove(
        auth.userId,
        parsed.data.from,
        parsed.data.to,
      );
      if (!result.ok) {
        client.send(ACTION_REJECTED, { error: result.error });
      }
    });

    this.onMessage('restart', (client: AuthedClient) => {
      const auth = requireAuth(client);
      this.session.requestRestart(auth.userId);
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
    const color: Color | null = this.session.addPlayer(auth.userId, client);
    client.send('init', { color, state: this.session.getPublicState() });
    if (!color) return;

    if (auth.mode === 'single') {
      this.session.enableBot(color);
    }
    client.send('state', this.session.getPublicState());
  }

  override onLeave(client: AuthedClient) {
    this.moveRateLimiter.clear(client);
    const auth = requireAuth(client);
    this.session.pauseForDisconnect(auth.userId, client);
  }

  override onDispose() {
    this.session?.dispose();
  }
}
