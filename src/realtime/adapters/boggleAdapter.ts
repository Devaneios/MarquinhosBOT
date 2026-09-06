import type { Cell } from 'services/activity/boggle/BoggleEngine';
import { BoggleSession } from 'services/activity/boggle/BoggleSession';
import type { AdapterContext, GameRoomAdapter } from '../GameRoomAdapter';

const SUBMIT_RATE_LIMIT_WINDOW_MS = 1000;
const SUBMIT_RATE_LIMIT_MAX = 10;
const MAX_PATH_LENGTH = 16;

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

export const boggleAdapter: GameRoomAdapter<BoggleSession> = {
  maxPlayers: 8,
  supportsBot: false,
  supportsQueue: false,

  setup(ctx: AdapterContext) {
    const session = new BoggleSession(
      {
        sessionKey: ctx.roomKey,
        instanceId: ctx.instanceId,
        guildId: ctx.guildId,
        mode: ctx.mode,
      },
      {
        broadcast: (_key, message) =>
          ctx.broadcast(message.type, message.payload),
      },
      undefined,
      { onSessionEnded: ctx.onSessionEnded },
    );

    return {
      session,
      messageHandlers: {
        submit_word: {
          rateLimit: {
            windowMs: SUBMIT_RATE_LIMIT_WINDOW_MS,
            max: SUBMIT_RATE_LIMIT_MAX,
          },
          handle: (auth, client, payload: unknown) => {
            const path = (payload as { path?: unknown })?.path;
            if (!isValidPathPayload(path)) {
              client.send('submit_error', { message: 'Invalid path' });
              return;
            }
            const result = session.submitWord(auth.userId, path);
            if (!result.accepted)
              client.send('submit_error', { reason: result.reason });
          },
        },
        leave: { handle: (auth, client) => session.leave(auth.userId, client) },
      },
    };
  },

  onJoin(session, auth, client, seat) {
    if (seat !== 'player') {
      client.send('init', {
        grid: session.getPublicGrid(),
        state: session.getState(),
      });
      return;
    }
    session.addPlayer(auth.userId, client);
    client.send('init', {
      grid: session.getPublicGrid(),
      state: session.getState(),
    });
  },
  onLeave(session, auth, client) {
    session.pauseForDisconnect(auth.userId, client);
  },
  onDispose(session) {
    session?.dispose();
  },
};
