import { Room, type Client } from 'colyseus';
import { roomKey } from 'services/activity/roomKey';
import { ACTION_REJECTED } from 'services/activity/shared/ActionResult';
import { RateLimiter } from 'services/activity/shared/RateLimiter';
import { TowerSession } from 'services/activity/towerUnstable/TowerSession';
import {
  verifyWsSessionToken,
  type WsSessionPayload,
} from 'services/activity/wsSessionToken';

const PULL_RATE_LIMIT_WINDOW_MS = 1000;
const PULL_RATE_LIMIT_MAX = 5;

export class TowerUnstableRoom extends Room {
  private session!: TowerSession;
  private pullRateLimiter = new RateLimiter({
    windowMs: PULL_RATE_LIMIT_WINDOW_MS,
    max: PULL_RATE_LIMIT_MAX,
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

    const broadcaster = {
      broadcast: (
        _key: string,
        message: { type: string; payload?: unknown },
      ) => {
        this.broadcast(message.type, message.payload);
      },
    };

    this.session = new TowerSession(
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
      'pull',
      (client, payload: { level?: number; position?: number }) => {
        if (this.pullRateLimiter.isOverLimit(client)) return;
        const auth = client.auth as WsSessionPayload;
        const result = this.session.handlePull(
          auth.userId,
          payload?.level ?? -1,
          payload?.position ?? -1,
        );
        if (!result.ok) {
          client.send(ACTION_REJECTED, { error: result.error });
        }
      },
    );

    this.onMessage('restart', (client) => {
      const auth = client.auth as WsSessionPayload;
      this.session.requestRestart(auth.userId);
    });

    this.onMessage('leave', (client) => {
      const auth = client.auth as WsSessionPayload;
      this.session.leave(auth.userId, client);
    });
  }

  override onJoin(client: Client, _options: unknown, auth: WsSessionPayload) {
    const joined = this.session.addPlayer(auth.userId, client);
    if (joined && auth.mode === 'single') {
      this.session.enableBot();
    }
    client.send('init', {
      joined,
      state: this.session.getPublicState(),
    });

    if (this.session.playerCount === 2) {
      this.broadcast('game_ready', { state: this.session.getPublicState() });
    }
  }

  override onLeave(client: Client) {
    this.pullRateLimiter.clear(client);
    const auth = client.auth as WsSessionPayload;
    this.session.pauseForDisconnect(auth.userId, client);
  }

  override onDispose() {
    this.session.dispose();
  }
}
