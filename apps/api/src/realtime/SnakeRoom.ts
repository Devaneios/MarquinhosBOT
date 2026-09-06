import { Room, type Client } from 'colyseus';
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

export class SnakeRoom extends Room {
  private session!: SnakeSession;
  private inputRateLimiter = new RateLimiter({
    windowMs: INPUT_RATE_LIMIT_WINDOW_MS,
    max: INPUT_RATE_LIMIT_MAX,
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

    this.onMessage(
      'input',
      (client, payload: { direction?: string; seq?: number }) => {
        if (this.inputRateLimiter.isOverLimit(client)) return;
        const auth = client.auth as WsSessionPayload;
        this.session.handleInput(auth.userId, payload?.direction ?? 'right');
      },
    );

    this.onMessage('leave', (client) => {
      const auth = client.auth as WsSessionPayload;
      this.session.leave(auth.userId, client);
    });
  }

  override onJoin(client: Client, _options: unknown, auth: WsSessionPayload) {
    const playerId = this.session.addPlayer(auth.userId, client);
    if (auth.mode === 'single') {
      this.session.enableBot();
    }
    client.send('init', {
      playerId,
      config: this.session.getPublicConfig(),
    });
  }

  override onLeave(client: Client) {
    this.inputRateLimiter.clear(client);
    const auth = client.auth as WsSessionPayload;
    this.session.pauseForDisconnect(auth.userId, client);
  }

  override onDispose() {
    this.session.dispose();
  }
}
