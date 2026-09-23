import { gridCellSchema } from 'realtime/payloadSchemas';
import { BoggleSession } from 'services/activity/boggle/BoggleSession';
import { z } from 'zod';
import type { AdapterContext, GameRoomAdapter } from '../GameRoomAdapter';

const SUBMIT_RATE_LIMIT_WINDOW_MS = 1000;
const SUBMIT_RATE_LIMIT_MAX = 10;
const MAX_PATH_LENGTH = 16;

export const submitWordPayloadSchema = z.object({
  path: z.array(gridCellSchema).min(1).max(MAX_PATH_LENGTH),
});

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
            const parsed = submitWordPayloadSchema.safeParse(payload);
            if (!parsed.success) {
              client.send('submit_error', { message: 'Invalid path' });
              return;
            }
            const result = session.submitWord(auth.userId, parsed.data.path);
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
