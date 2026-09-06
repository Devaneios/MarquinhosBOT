import { Room, type Client } from 'colyseus';
import { roomKey } from 'services/activity/roomKey';
import { ACTION_REJECTED } from 'services/activity/shared/ActionResult';
import { RateLimiter } from 'services/activity/shared/RateLimiter';
import { TicTacToeSession } from 'services/activity/ticTacToe/TicTacToeSession';
import {
  verifyWsSessionToken,
  type WsSessionPayload,
} from 'services/activity/wsSessionToken';

const MOVE_RATE_LIMIT_WINDOW_MS = 1000;
const MOVE_RATE_LIMIT_MAX = 10;

export class TicTacToeRoom extends Room {
  private session!: TicTacToeSession;
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

    const broadcaster = {
      broadcast: (
        _key: string,
        message: { type: string; payload?: unknown },
      ) => {
        this.broadcast(message.type, message.payload);
      },
    };

    this.session = new TicTacToeSession(
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
      'move',
      (client, payload: { row?: number; col?: number }) => {
        if (this.moveRateLimiter.isOverLimit(client)) return;
        const auth = client.auth as WsSessionPayload;
        const result = this.session.handleMove(
          auth.userId,
          payload?.row ?? -1,
          payload?.col ?? -1,
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
    const player = this.session.addPlayer(auth.userId, client);
    client.send('init', {
      player,
      state: this.session.getPublicState(),
    });
    if (!player) return;

    if (auth.mode === 'single') {
      this.session.enableBot(player);
    }

    if (this.session.playerCount === 2) {
      this.broadcast('game_ready', {
        state: this.session.getPublicState(),
      });
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
