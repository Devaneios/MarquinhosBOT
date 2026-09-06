import { Room, type Client } from 'colyseus';
import type { ShipPlacement } from 'services/activity/battleship/BattleshipEngine';
import { BattleshipSession } from 'services/activity/battleship/BattleshipSession';
import type { PerClientBroadcaster } from 'services/activity/cards/PerClientBroadcaster';
import { roomKey } from 'services/activity/roomKey';
import { RateLimiter } from 'services/activity/shared/RateLimiter';
import {
  verifyWsSessionToken,
  type WsSessionPayload,
} from 'services/activity/wsSessionToken';

const FIRE_RATE_LIMIT_WINDOW_MS = 1000;
const FIRE_RATE_LIMIT_MAX = 5;
const PLACE_RATE_LIMIT_WINDOW_MS = 1000;
const PLACE_RATE_LIMIT_MAX = 3;

export class BattleshipRoom extends Room {
  private session!: BattleshipSession;
  private fireRateLimiter = new RateLimiter({
    windowMs: FIRE_RATE_LIMIT_WINDOW_MS,
    max: FIRE_RATE_LIMIT_MAX,
  });
  private placeRateLimiter = new RateLimiter({
    windowMs: PLACE_RATE_LIMIT_WINDOW_MS,
    max: PLACE_RATE_LIMIT_MAX,
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

    const broadcaster: PerClientBroadcaster = {
      sendToPlayer: (userId, message) => {
        for (const client of this.clients) {
          if ((client.auth as WsSessionPayload)?.userId !== userId) continue;
          client.send(message.type, message.payload);
        }
      },
      broadcastPublic: (message) => {
        this.broadcast(message.type, message.payload);
      },
    };

    this.session = new BattleshipSession(
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
      'place_ships',
      (client, payload: { placements?: ShipPlacement[] }) => {
        if (this.placeRateLimiter.isOverLimit(client)) return;
        const auth = client.auth as WsSessionPayload;
        if (!Array.isArray(payload?.placements)) return;
        this.session.placeShips(auth.userId, payload.placements);
      },
    );

    this.onMessage('fire', (client, payload: { x?: number; y?: number }) => {
      if (this.fireRateLimiter.isOverLimit(client)) return;
      const auth = client.auth as WsSessionPayload;
      if (typeof payload?.x !== 'number' || typeof payload?.y !== 'number') {
        return;
      }
      this.session.fire(auth.userId, payload.x, payload.y);
    });

    this.onMessage('leave', (client) => {
      const auth = client.auth as WsSessionPayload;
      this.session.leave(auth.userId, client);
    });
  }

  override onJoin(client: Client, _options: unknown, auth: WsSessionPayload) {
    const side = this.session.addPlayer(auth.userId, client);
    client.send('init', { side });
    if (side && auth.mode === 'single') {
      this.session.enableBot(side);
    }
  }

  override onLeave(client: Client) {
    this.fireRateLimiter.clear(client);
    this.placeRateLimiter.clear(client);
    const auth = client.auth as WsSessionPayload;
    this.session.pauseForDisconnect(auth.userId, client);
  }

  override onDispose() {
    this.session.dispose();
  }
}
