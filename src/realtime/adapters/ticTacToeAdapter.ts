import { ACTION_REJECTED } from 'services/activity/shared/ActionResult';
import { TicTacToeSession } from 'services/activity/ticTacToe/TicTacToeSession';
import type { AdapterContext, GameRoomAdapter } from '../GameRoomAdapter';

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
            const { row, col } =
              (payload as { row?: number; col?: number }) ?? {};
            const result = session.handleMove(
              auth.userId,
              row ?? -1,
              col ?? -1,
            );
            if (!result.ok)
              client.send(ACTION_REJECTED, { error: result.error });
          },
        },
        restart: {
          handle: (auth) => session.requestRestart(auth.userId),
        },
        leave: {
          // A deliberate quit uses the immediate-detach path (`leave`), not
          // the disconnect-with-grace path (`pauseForDisconnect`) that
          // `onLeave` uses for a network drop — matches TicTacToeRoom's
          // original distinction between the two.
          handle: (auth, client) => session.leave(auth.userId, client),
        },
      },
    };
  },

  onJoin(session, auth, client, seat, ctx) {
    // Matches TicTacToeRoom.onJoin's original behavior exactly: it never
    // kicked an overflow joiner, it just sent `init` with a null `player`
    // and left the connection open watching broadcasts.
    if (seat !== 'player') {
      client.send('init', { player: null, state: session.getPublicState() });
      return;
    }
    const player = session.addPlayer(auth.userId, client);
    client.send('init', { player, state: session.getPublicState() });
    if (!player) return;

    if (auth.mode === 'single') session.enableBot(player);

    if (session.playerCount === 2) {
      ctx.broadcast('game_ready', {
        state: session.getPublicState(),
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
