import { Room, type Client } from 'colyseus';
import { BingoSpeedSession } from 'services/activity/bingoSpeed/BingoSpeedSession';
import { roomKey } from 'services/activity/roomKey';
import type { ActivityBroadcaster } from 'services/activity/shared/ActivityBroadcaster';
import { RateLimiter } from 'services/activity/shared/RateLimiter';
import {
  verifyWsSessionToken,
  type WsSessionPayload,
} from 'services/activity/wsSessionToken';

const CLAIM_RATE_LIMIT_WINDOW_MS = 1000;
const CLAIM_RATE_LIMIT_MAX = 5;

export class BingoSpeedRoom extends Room {
  private session!: BingoSpeedSession;
  private claimRateLimiter = new RateLimiter({
    windowMs: CLAIM_RATE_LIMIT_WINDOW_MS,
    max: CLAIM_RATE_LIMIT_MAX,
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

    this.session = new BingoSpeedSession(
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

    this.onMessage('claim_bingo', (client) => {
      if (this.claimRateLimiter.isOverLimit(client)) return;
      const auth = client.auth as WsSessionPayload;
      const result = this.session.claimBingo(auth.userId);
      client.send('bingo_claim_result', result);
    });

    this.onMessage('leave', (client) => {
      const auth = client.auth as WsSessionPayload;
      this.session.leave(auth.userId, client);
    });
  }

  override onJoin(client: Client, _options: unknown, auth: WsSessionPayload) {
    const card = this.session.addPlayer(auth.userId, client);
    const state = this.session.getPublicState();

    client.send('init', {
      card,
      state,
    });

    if (this.session.playerCount >= 2 && auth.mode === 'multi') {
      this.session.start();
    }
  }

  override onLeave(client: Client) {
    this.claimRateLimiter.clear(client);
    const auth = client.auth as WsSessionPayload;
    this.session.pauseForDisconnect(auth.userId, client);
  }

  override onDispose() {
    this.session.dispose();
  }
}
