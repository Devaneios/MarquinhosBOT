import { Room, type Client } from 'colyseus';
import { ConnectFourSession } from 'services/activity/connectFour/ConnectFourSession';
import { roomKey } from 'services/activity/roomKey';
import { RateLimiter } from 'services/activity/shared/RateLimiter';
import {
  verifyWsSessionToken,
  type WsSessionPayload,
} from 'services/activity/wsSessionToken';

const MOVE_RATE_LIMIT_WINDOW_MS = 1000;
const MOVE_RATE_LIMIT_MAX = 10;

export class ConnectFourRoom extends Room {
  private session!: ConnectFourSession;
  private moveRateLimiter = new RateLimiter({
    windowMs: MOVE_RATE_LIMIT_WINDOW_MS,
    max: MOVE_RATE_LIMIT_MAX,
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

    this.session = new ConnectFourSession(
      {
        sessionKey: options.roomKey,
        instanceId: initialSession?.instanceId ?? '',
        guildId: initialSession?.guildId ?? '',
        mode: initialSession?.mode ?? 'multi',
      },
      {
        broadcast: (_key, message) => {
          this.broadcast(message.type, message.payload);
        },
      },
      undefined,
      { onSessionEnded: () => this.disconnect() },
    );

    this.onMessage('drop', (client, payload: { col?: number }) => {
      if (this.moveRateLimiter.isOverLimit(client)) return;
      const auth = client.auth as WsSessionPayload;
      const accepted = this.session.dropDisc(auth.userId, payload?.col ?? -1);
      if (!accepted) client.send('move_rejected', { col: payload?.col });
    });

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
    const disc = this.session.addPlayer(auth.userId, client);
    client.send('init', { disc, state: this.session.getPublicState() });
    if (!disc) return;

    if (auth.mode === 'single') {
      this.session.enableBot(disc);
    }
  }

  override onLeave(client: Client) {
    this.moveRateLimiter.clear(client);
    const auth = client.auth as WsSessionPayload;
    this.session.pauseForDisconnect(auth.userId, client);
  }

  override onDispose() {
    this.session.dispose();
  }
}
