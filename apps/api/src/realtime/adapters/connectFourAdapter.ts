import {
  dropPayloadSchema,
  type ConnectFourServerMessage,
} from '@marquinhos/contracts/activity/games/connectFour';
import { ConnectFourSession } from 'services/activity/connectFour/ConnectFourSession';
import type { AdapterContext, GameRoomAdapter } from '../GameRoomAdapter';
import { sendMessage } from '../sendMessage';

const MOVE_RATE_LIMIT_WINDOW_MS = 1000;
const MOVE_RATE_LIMIT_MAX = 10;

export const connectFourAdapter: GameRoomAdapter<ConnectFourSession> = {
  maxPlayers: 2,
  supportsBot: true,
  supportsQueue: true,

  setup(ctx: AdapterContext) {
    const session = new ConnectFourSession(
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
        drop: {
          rateLimit: {
            windowMs: MOVE_RATE_LIMIT_WINDOW_MS,
            max: MOVE_RATE_LIMIT_MAX,
          },
          handle: (auth, client, payload: unknown) => {
            const parsed = dropPayloadSchema.safeParse(payload);
            const col = parsed.data?.col;
            const accepted =
              col !== undefined && session.dropDisc(auth.userId, col);
            if (!accepted)
              sendMessage<ConnectFourServerMessage>(client, {
                type: 'move_rejected',
                payload: { col },
              });
          },
        },
        restart: { handle: (auth) => session.requestRestart(auth.userId) },
        leave: {
          // A deliberate quit uses the immediate-detach path (`leave`), not
          // the disconnect-with-grace path (`pauseForDisconnect`) that
          // `onLeave` uses for a network drop — matches ticTacToeAdapter's
          // distinction between the two, and is also what MatchRoom's queue
          // hand-off is gated on.
          handle: (auth, client) => session.leave(auth.userId, client),
        },
      },
    };
  },

  onJoin(session, auth, client, seat) {
    if (seat !== 'player') {
      sendMessage<ConnectFourServerMessage>(client, {
        type: 'init',
        payload: { disc: null, state: session.getPublicState() },
      });
      return;
    }
    const disc = session.addPlayer(auth.userId, client);
    sendMessage<ConnectFourServerMessage>(client, {
      type: 'init',
      payload: { disc, state: session.getPublicState() },
    });
    if (disc && auth.mode === 'single') session.enableBot(disc);
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
    const disc = session.substitutePlayer(
      outgoingUserId,
      incomingUserId,
      incomingClient,
    );
    if (!disc) return false;
    sendMessage<ConnectFourServerMessage>(incomingClient, {
      type: 'init',
      payload: { disc, state: session.getPublicState() },
    });
    return true;
  },
};
