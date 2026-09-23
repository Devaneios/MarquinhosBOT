import { roomKey } from '@marquinhos/domain/activity/roomKey';
import { Room } from 'colyseus';
import {
  endPayloadSchema,
  tilePayloadSchema,
} from 'realtime/adapters/dominoesAdapter';
import { requireAuth, type AuthedClient } from 'realtime/authedClient';
import { DominoesSession } from 'services/activity/dominoesBlock/DominoesSession';
import { RateLimiter } from 'services/activity/shared/RateLimiter';
import {
  verifyWsSessionToken,
  type WsSessionPayload,
} from 'services/activity/wsSessionToken';

const MOVE_RATE_LIMIT_WINDOW_MS = 1000;
const MOVE_RATE_LIMIT_MAX = 10;

export class DominoesBlockRoom extends Room<{ client: AuthedClient }> {
  private session!: DominoesSession;
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

    this.session = new DominoesSession(
      {
        sessionKey: options.roomKey,
        instanceId: initialSession?.instanceId ?? '',
        guildId: initialSession?.guildId ?? '',
      },
      {
        sendToPlayer: (userId, message) => {
          for (const client of this.clients) {
            const auth = client.auth;
            if (auth?.userId === userId)
              client.send(message.type, message.payload);
          }
        },
        broadcastPublic: (message) => {
          this.broadcast(message.type, message.payload);
        },
      },
      undefined,
      { onSessionEnded: () => this.disconnect() },
    );

    this.onMessage('play', (client: AuthedClient, payload: unknown) => {
      if (this.moveRateLimiter.isOverLimit(client)) return;
      const auth = requireAuth(client);
      const tile = tilePayloadSchema.safeParse(payload);
      if (!tile.success) {
        client.send('move_rejected', { reason: 'Malformed tile' });
        return;
      }
      const end = endPayloadSchema.safeParse(payload);
      if (!end.success) {
        client.send('move_rejected', { reason: 'Malformed end' });
        return;
      }
      this.session.playTile(auth.userId, tile.data.tile, end.data.end);
    });

    this.onMessage('pass', (client: AuthedClient) => {
      if (this.moveRateLimiter.isOverLimit(client)) return;
      const auth = requireAuth(client);
      this.session.passTurn(auth.userId);
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
    this.session.addPlayer(auth.userId, client);
    if (auth.mode === 'single') {
      this.session.enableBot();
    }
  }

  override onLeave(client: AuthedClient) {
    this.moveRateLimiter.clear(client);
    const auth = requireAuth(client);
    this.session.pauseForDisconnect(auth.userId, client);
  }

  override onDispose() {
    this.session.dispose();
  }
}
