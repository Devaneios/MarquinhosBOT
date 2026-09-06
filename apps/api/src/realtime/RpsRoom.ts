import { Room, type Client } from 'colyseus';
import { roomKey } from 'services/activity/roomKey';
import { RpsSession } from 'services/activity/rps/RpsSession';
import { RateLimiter } from 'services/activity/shared/RateLimiter';
import {
  verifyWsSessionToken,
  type WsSessionPayload,
} from 'services/activity/wsSessionToken';

const PICK_RATE_LIMIT_WINDOW_MS = 1000;
const PICK_RATE_LIMIT_MAX = 10;

export class RpsRoom extends Room {
  private session!: RpsSession;
  private pickRateLimiter = new RateLimiter({
    windowMs: PICK_RATE_LIMIT_WINDOW_MS,
    max: PICK_RATE_LIMIT_MAX,
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

    this.session = new RpsSession(
      {
        sessionKey: options.roomKey,
        instanceId: initialSession?.instanceId ?? '',
        guildId: initialSession?.guildId ?? '',
        mode: initialSession?.mode ?? 'multi',
      },
      broadcaster,
      undefined,
      undefined,
      { onSessionEnded: () => this.disconnect() },
    );

    this.onMessage('pick', (client, payload: { pick?: string }) => {
      if (this.pickRateLimiter.isOverLimit(client)) return;
      const auth = client.auth as WsSessionPayload;
      const success = this.session.submitPick(auth.userId, payload?.pick);
      if (!success) {
        client.send('error', { message: 'Invalid move' });
      }
    });

    this.onMessage('leave', (client) => {
      const auth = client.auth as WsSessionPayload;
      this.session.leave(auth.userId, client);
    });
  }

  override onJoin(client: Client, _options: unknown, auth: WsSessionPayload) {
    const playerId = this.session.addPlayer(auth.userId, client);
    if (!playerId) {
      client.send('error', { message: 'Game is full' });
      client.leave();
      return;
    }

    client.send('init', {
      playerId,
      config: this.session.getPublicConfig(),
    });

    if (auth.mode === 'single') {
      this.session.enableBot(playerId);
    }

    if (this.session.playerCount === 2 || auth.mode === 'single') {
      this.broadcast('game_start', {});
      this.broadcast('round_state', this.session.getRoundState());
    }
  }

  override onLeave(client: Client) {
    this.pickRateLimiter.clear(client);
    const auth = client.auth as WsSessionPayload;
    this.session.pauseForDisconnect(auth.userId, client);
  }

  override onDispose() {
    this.session.dispose();
  }
}
