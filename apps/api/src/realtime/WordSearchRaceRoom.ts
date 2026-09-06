import { Room, type Client } from 'colyseus';
import { roomKey } from 'services/activity/roomKey';
import type { ActivityBroadcaster } from 'services/activity/shared/ActivityBroadcaster';
import { RateLimiter } from 'services/activity/shared/RateLimiter';
import type { Cell } from 'services/activity/word-search-race/WordSearchRaceEngine';
import { WordSearchRaceSession } from 'services/activity/word-search-race/WordSearchRaceSession';
import {
  verifyWsSessionToken,
  type WsSessionPayload,
} from 'services/activity/wsSessionToken';

const SELECT_RATE_LIMIT_WINDOW_MS = 1000;
const SELECT_RATE_LIMIT_MAX = 10;

function isValidCell(value: unknown): value is Cell {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Cell).row === 'number' &&
    typeof (value as Cell).col === 'number' &&
    Number.isInteger((value as Cell).row) &&
    Number.isInteger((value as Cell).col)
  );
}

export class WordSearchRaceRoom extends Room {
  private session!: WordSearchRaceSession;
  private selectRateLimiter = new RateLimiter({
    windowMs: SELECT_RATE_LIMIT_WINDOW_MS,
    max: SELECT_RATE_LIMIT_MAX,
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

    this.session = new WordSearchRaceSession(
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
      'select',
      (client, payload: { start?: unknown; end?: unknown }) => {
        if (this.selectRateLimiter.isOverLimit(client)) return;
        if (!isValidCell(payload?.start) || !isValidCell(payload?.end)) {
          client.send('select_error', { message: 'Invalid selection' });
          return;
        }

        const auth = client.auth as WsSessionPayload;
        const result = this.session.submitSelection(
          auth.userId,
          payload.start,
          payload.end,
        );

        if ('error' in result) {
          client.send('select_error', { message: result.error });
        }
      },
    );

    this.onMessage('leave', (client) => {
      const auth = client.auth as WsSessionPayload;
      this.session.removePlayer(auth.userId, client);
    });
  }

  override onJoin(client: Client, _options: unknown, auth: WsSessionPayload) {
    this.session.addPlayer(auth.userId, client);
    client.send('init', this.session.getPublicState());
  }

  override onLeave(client: Client) {
    this.selectRateLimiter.clear(client);
    const auth = client.auth as WsSessionPayload;
    this.session.removePlayer(auth.userId, client);
  }

  override onDispose() {
    this.session.dispose();
  }
}
