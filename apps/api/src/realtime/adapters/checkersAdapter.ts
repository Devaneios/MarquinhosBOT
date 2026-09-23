import {
  movePayloadSchema,
  type CheckersServerMessage,
} from '@marquinhos/contracts/activity/games/checkers';
import { ACTION_REJECTED } from '@marquinhos/contracts/activity/protocol';
import { CheckersSession } from 'services/activity/checkers/CheckersSession';
import type { AdapterContext, GameRoomAdapter } from '../GameRoomAdapter';
import { sendMessage } from '../sendMessage';

const MOVE_RATE_LIMIT_WINDOW_MS = 1000;
const MOVE_RATE_LIMIT_MAX = 10;

export const checkersAdapter: GameRoomAdapter<CheckersSession> = {
  maxPlayers: 2,
  supportsBot: true,
  supportsQueue: true,

  setup(ctx: AdapterContext) {
    const session = new CheckersSession(
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
        move: {
          rateLimit: {
            windowMs: MOVE_RATE_LIMIT_WINDOW_MS,
            max: MOVE_RATE_LIMIT_MAX,
          },
          handle: (auth, client, payload: unknown) => {
            const parsed = movePayloadSchema.safeParse(payload);
            if (!parsed.success) return;
            const result = session.requestMove(
              auth.userId,
              parsed.data.from,
              parsed.data.to,
            );
            if (!result.ok)
              sendMessage<CheckersServerMessage>(client, {
                type: ACTION_REJECTED,
                payload: { error: result.error },
              });
          },
        },
        restart: { handle: (auth) => session.requestRestart(auth.userId) },
        leave: {
          handle: (auth, client) => session.leave(auth.userId, client),
        },
      },
    };
  },

  onJoin(session, auth, client, seat) {
    if (seat !== 'player') {
      sendMessage<CheckersServerMessage>(client, {
        type: 'init',
        payload: { color: null, state: session.getPublicState() },
      });
      return;
    }
    const color = session.addPlayer(auth.userId, client);
    sendMessage<CheckersServerMessage>(client, {
      type: 'init',
      payload: { color, state: session.getPublicState() },
    });
    if (!color) return;
    if (auth.mode === 'single') session.enableBot(color);
    sendMessage<CheckersServerMessage>(client, {
      type: 'state',
      payload: session.getPublicState(),
    });
  },
  onLeave(session, auth, client) {
    session.pauseForDisconnect(auth.userId, client);
  },
  onDispose(session) {
    session.dispose();
  },
  getWinnerUserId(session) {
    return session.getWinnerUserId();
  },
  substitutePlayer(session, outgoingUserId, incomingUserId, incomingClient) {
    return session.substitutePlayer(
      outgoingUserId,
      incomingUserId,
      incomingClient,
    );
  },
};
