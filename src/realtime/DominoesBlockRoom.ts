import { Room, type Client } from 'colyseus';
import type {
  ChainEnd,
  Tile,
} from 'services/activity/dominoesBlock/DominoesEngine';
import { DominoesSession } from 'services/activity/dominoesBlock/DominoesSession';
import { roomKey } from 'services/activity/roomKey';
import { RateLimiter } from 'services/activity/shared/RateLimiter';
import {
  verifyWsSessionToken,
  type WsSessionPayload,
} from 'services/activity/wsSessionToken';

const MOVE_RATE_LIMIT_WINDOW_MS = 1000;
const MOVE_RATE_LIMIT_MAX = 10;

function isTile(value: unknown): value is Tile {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Tile).a === 'number' &&
    typeof (value as Tile).b === 'number' &&
    Number.isInteger((value as Tile).a) &&
    Number.isInteger((value as Tile).b) &&
    (value as Tile).a >= 0 &&
    (value as Tile).a <= 6 &&
    (value as Tile).b >= 0 &&
    (value as Tile).b <= 6
  );
}

function isChainEnd(value: unknown): value is ChainEnd {
  return value === 'left' || value === 'right';
}

export class DominoesBlockRoom extends Room {
  private session!: DominoesSession;
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

    this.session = new DominoesSession(
      {
        sessionKey: options.roomKey,
        instanceId: initialSession?.instanceId ?? '',
        guildId: initialSession?.guildId ?? '',
      },
      {
        sendToPlayer: (userId, message) => {
          for (const client of this.clients) {
            const auth = client.auth as WsSessionPayload | undefined;
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

    this.onMessage(
      'play',
      (client, payload: { tile?: Tile; end?: ChainEnd }) => {
        if (this.moveRateLimiter.isOverLimit(client)) return;
        const auth = client.auth as WsSessionPayload;
        if (!isTile(payload?.tile)) {
          client.send('move_rejected', { reason: 'Malformed tile' });
          return;
        }
        const end = payload?.end;
        if (end !== undefined && !isChainEnd(end)) {
          client.send('move_rejected', { reason: 'Malformed end' });
          return;
        }
        this.session.playTile(auth.userId, payload.tile, end);
      },
    );

    this.onMessage('pass', (client) => {
      if (this.moveRateLimiter.isOverLimit(client)) return;
      const auth = client.auth as WsSessionPayload;
      this.session.passTurn(auth.userId);
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
    this.session.addPlayer(auth.userId, client);
    if (auth.mode === 'single') {
      this.session.enableBot();
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
