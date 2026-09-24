import {
  submitWordPayloadSchema,
  type BoggleServerMessage,
} from '@marquinhos/contracts/activity/games/boggleWordRace';
import { BoggleSession } from 'services/activity/boggle/BoggleSession';
import type { AdapterContext, GameRoomAdapter } from '../GameRoomAdapter';
import { sendMessage } from '../sendMessage';

const SUBMIT_RATE_LIMIT_WINDOW_MS = 1000;
const SUBMIT_RATE_LIMIT_MAX = 10;

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
              sendMessage<BoggleServerMessage>(client, {
                type: 'submit_error',
                payload: { reason: 'invalid_path' },
              });
              return;
            }
            const result = session.submitWord(auth.userId, parsed.data.path);
            if (!result.accepted)
              sendMessage<BoggleServerMessage>(client, {
                type: 'submit_error',
                payload: { reason: result.reason },
              });
          },
        },
        leave: { handle: (auth, client) => session.leave(auth.userId, client) },
      },
    };
  },

  onJoin(session, auth, client, seat) {
    if (seat !== 'player') {
      sendMessage<BoggleServerMessage>(client, {
        type: 'init',
        payload: { grid: session.getPublicGrid(), state: session.getState() },
      });
      return;
    }
    session.addPlayer(auth.userId, client);
    sendMessage<BoggleServerMessage>(client, {
      type: 'init',
      payload: { grid: session.getPublicGrid(), state: session.getState() },
    });
  },
  onLeave(session, auth, client) {
    session.pauseForDisconnect(auth.userId, client);
  },
  onDispose(session) {
    session?.dispose();
  },
};
