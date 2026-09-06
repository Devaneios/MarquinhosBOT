import { Room, type Client } from 'colyseus';
import { CardTableSession } from 'services/activity/cards/CardTableSession';
import type { PerClientBroadcaster } from 'services/activity/cards/PerClientBroadcaster';
import { cardGameRegistry } from 'services/activity/cards/registry';
import { roomKey } from 'services/activity/roomKey';
import { RateLimiter } from 'services/activity/shared/RateLimiter';
import {
  verifyWsSessionToken,
  type WsSessionPayload,
} from 'services/activity/wsSessionToken';
import { GamificationService } from 'services/gamification/GamificationService';

const MOVE_RATE_LIMIT_WINDOW_MS = 1000;
// Looser than Pong's input limiter — card moves are human-paced (clicks),
// not a held-key stream sampled every tick.
const MOVE_RATE_LIMIT_MAX = 20;

export class CardTableRoom extends Room {
  private session!: CardTableSession<unknown>;
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
    if (!initialSession?.ruleset) {
      throw new Error('A cards room requires a ruleset');
    }
    const definition = cardGameRegistry.get(initialSession.ruleset);
    if (!definition) {
      throw new Error(`Unknown card ruleset: ${initialSession.ruleset}`);
    }

    const broadcaster: PerClientBroadcaster = {
      // EVERY socket this user holds, not the first one found. A React remount
      // opens a second socket before the first finishes closing, and a user with
      // two tabs is two clients for one userId — which is exactly why
      // CardTableSession tracks a Set of connections per player. Delivering to
      // one of them leaves the other stuck on the loading state forever.
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

    this.session = new CardTableSession(
      {
        sessionKey: options.roomKey,
        instanceId: initialSession.instanceId,
        guildId: initialSession.guildId,
      },
      broadcaster,
      definition,
      new GamificationService(),
      {
        onSessionEnded: () => this.disconnect(),
        setupOptions: initialSession.options,
      },
    );

    this.onMessage(
      'move',
      (client, payload: { move?: string; args?: unknown }) => {
        if (this.moveRateLimiter.isOverLimit(client)) return;
        const auth = client.auth as WsSessionPayload;
        if (!payload?.move) return;
        this.session.handleMove(auth.userId, payload.move, payload.args);
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
    // Sent before addPlayer() so a client's first message is always its
    // seat assignment — addPlayer can synchronously trigger a masked
    // 'state' broadcast (once the table fills) that would otherwise race
    // ahead of this message to the very client that just joined.
    const seatIndex = this.session.seatIndexFor(auth.userId);
    client.send('init', { seatIndex });
    this.session.addPlayer(auth.userId, client);
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
