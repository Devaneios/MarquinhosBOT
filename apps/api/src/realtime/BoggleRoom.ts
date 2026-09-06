import { Room, type Client } from 'colyseus';
import type { Cell } from 'services/activity/boggle/BoggleEngine';
import { BoggleSession } from 'services/activity/boggle/BoggleSession';
import { roomKey } from 'services/activity/roomKey';
import type { ActivityBroadcaster } from 'services/activity/shared/ActivityBroadcaster';
import { RateLimiter } from 'services/activity/shared/RateLimiter';
import {
  verifyWsSessionToken,
  type WsSessionPayload,
} from 'services/activity/wsSessionToken';

const SUBMIT_RATE_LIMIT_WINDOW_MS = 1000;
const SUBMIT_RATE_LIMIT_MAX = 10;
const MAX_PATH_LENGTH = 16; // can't exceed the number of cells on a 4x4 board

function isValidPathPayload(value: unknown): value is Cell[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= MAX_PATH_LENGTH &&
    value.every(
      (cell) =>
        typeof cell === 'object' &&
        cell !== null &&
        typeof (cell as Cell).row === 'number' &&
        typeof (cell as Cell).col === 'number' &&
        Number.isInteger((cell as Cell).row) &&
        Number.isInteger((cell as Cell).col),
    )
  );
}

export class BoggleRoom extends Room {
  private session!: BoggleSession;
  private submitRateLimiter = new RateLimiter({
    windowMs: SUBMIT_RATE_LIMIT_WINDOW_MS,
    max: SUBMIT_RATE_LIMIT_MAX,
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

    this.session = new BoggleSession(
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

    this.onMessage('submit_word', (client, payload: { path?: unknown }) => {
      if (this.submitRateLimiter.isOverLimit(client)) return;
      if (!isValidPathPayload(payload?.path)) {
        client.send('submit_error', { message: 'Invalid path' });
        return;
      }

      const auth = client.auth as WsSessionPayload;
      const result = this.session.submitWord(auth.userId, payload.path);
      if (!result.accepted) {
        client.send('submit_error', { reason: result.reason });
      }
    });

    this.onMessage('leave', (client) => {
      const auth = client.auth as WsSessionPayload;
      this.session.leave(auth.userId, client);
    });
  }

  override onJoin(client: Client, _options: unknown, auth: WsSessionPayload) {
    this.session.addPlayer(auth.userId, client);
    client.send('init', {
      grid: this.session.getPublicGrid(),
      state: this.session.getState(),
    });
  }

  override onLeave(client: Client) {
    this.submitRateLimiter.clear(client);
    const auth = client.auth as WsSessionPayload;
    this.session.pauseForDisconnect(auth.userId, client);
  }

  override onDispose() {
    this.session?.dispose();
  }
}
