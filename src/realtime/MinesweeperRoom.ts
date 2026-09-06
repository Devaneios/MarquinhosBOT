import { Room, type Client } from 'colyseus';
import { MinesweeperSession } from 'services/activity/minesweeper/MinesweeperSession';
import { roomKey } from 'services/activity/roomKey';
import type { ActivityBroadcaster } from 'services/activity/shared/ActivityBroadcaster';
import { RateLimiter } from 'services/activity/shared/RateLimiter';
import {
  verifyWsSessionToken,
  type WsSessionPayload,
} from 'services/activity/wsSessionToken';

const REVEAL_RATE_LIMIT_WINDOW_MS = 1000;
const REVEAL_RATE_LIMIT_MAX = 20;

export class MinesweeperRoom extends Room {
  private session!: MinesweeperSession;
  private revealRateLimiter = new RateLimiter({
    windowMs: REVEAL_RATE_LIMIT_WINDOW_MS,
    max: REVEAL_RATE_LIMIT_MAX,
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

    this.session = new MinesweeperSession(
      {
        sessionKey: options.roomKey,
        instanceId: initialSession?.instanceId ?? '',
        guildId: initialSession?.guildId ?? '',
      },
      broadcaster,
      undefined,
      undefined,
      { onSessionEnded: () => this.disconnect() },
    );

    this.onMessage('reveal', (client, payload: { x?: number; y?: number }) => {
      if (this.revealRateLimiter.isOverLimit(client)) return;
      if (
        typeof payload?.x !== 'number' ||
        typeof payload?.y !== 'number' ||
        !Number.isInteger(payload.x) ||
        !Number.isInteger(payload.y)
      ) {
        client.send('reveal_error', { message: 'Invalid tile coordinates' });
        return;
      }

      const auth = client.auth as WsSessionPayload;
      const result = this.session.reveal(auth.userId, payload.x, payload.y);
      if ('error' in result) {
        client.send('reveal_error', { message: result.error });
      }
    });
  }

  override onJoin(client: Client, _options: unknown, auth: WsSessionPayload) {
    this.session.addPlayer(auth.userId, client);
    client.send('init', this.session.getBoardSnapshot());
  }

  override onLeave(client: Client) {
    this.revealRateLimiter.clear(client);
    const auth = client.auth as WsSessionPayload;
    this.session.removeConnection(auth.userId, client);
  }

  override onDispose() {
    this.session.dispose();
  }
}
