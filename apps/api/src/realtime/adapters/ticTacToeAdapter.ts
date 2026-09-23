import {
  movePayloadSchema,
  type TicTacToeServerMessage,
} from '@marquinhos/contracts/activity/games/ticTacToe';
import { ACTION_REJECTED } from '@marquinhos/contracts/activity/protocol';
import { TicTacToeSession } from 'services/activity/ticTacToe/TicTacToeSession';
import type { AdapterContext, GameRoomAdapter } from '../GameRoomAdapter';
import { broadcastMessage, sendMessage } from '../sendMessage';

const MOVE_RATE_LIMIT_WINDOW_MS = 1000;
const MOVE_RATE_LIMIT_MAX = 10;

export const ticTacToeAdapter: GameRoomAdapter<TicTacToeSession> = {
  maxPlayers: 2,
  supportsBot: true,
  supportsQueue: true,

  setup(ctx: AdapterContext) {
    const session = new TicTacToeSession(
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
            if (!parsed.success) {
              sendMessage<TicTacToeServerMessage>(client, {
                type: ACTION_REJECTED,
                payload: { error: 'Invalid move' },
              });
              return;
            }
            const result = session.handleMove(
              auth.userId,
              parsed.data.row,
              parsed.data.col,
            );
            if (!result.ok)
              sendMessage<TicTacToeServerMessage>(client, {
                type: ACTION_REJECTED,
                payload: { error: result.error },
              });
          },
        },
        restart: {
          handle: (auth) => session.requestRestart(auth.userId),
        },
        leave: {
          // A deliberate quit uses the immediate-detach path (`leave`), not
          // the disconnect-with-grace path (`pauseForDisconnect`) that
          // `onLeave` uses for a network drop.
          handle: (auth, client) => session.leave(auth.userId, client),
        },
      },
    };
  },

  onJoin(session, auth, client, seat, ctx) {
    // An overflow joiner is never kicked: it gets `init` with a null
    // `player` and stays connected watching broadcasts.
    if (seat !== 'player') {
      sendMessage<TicTacToeServerMessage>(client, {
        type: 'init',
        payload: { player: null, state: session.getPublicState() },
      });
      return;
    }
    const player = session.addPlayer(auth.userId, client);
    sendMessage<TicTacToeServerMessage>(client, {
      type: 'init',
      payload: { player, state: session.getPublicState() },
    });
    if (!player) return;

    if (auth.mode === 'single') session.enableBot(player);

    if (session.playerCount === 2) {
      broadcastMessage<TicTacToeServerMessage>(ctx, {
        type: 'game_ready',
        payload: { state: session.getPublicState() },
      });
    }
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
