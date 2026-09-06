import type { Position } from 'services/activity/checkers/CheckersEngine';
import { CheckersSession } from 'services/activity/checkers/CheckersSession';
import { ACTION_REJECTED } from 'services/activity/shared/ActionResult';
import type { AdapterContext, GameRoomAdapter } from '../GameRoomAdapter';

const MOVE_RATE_LIMIT_WINDOW_MS = 1000;
const MOVE_RATE_LIMIT_MAX = 10;

function isPosition(value: unknown): value is Position {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Position).row === 'number' &&
    typeof (value as Position).col === 'number' &&
    Number.isInteger((value as Position).row) &&
    Number.isInteger((value as Position).col)
  );
}

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
            const { from, to } =
              (payload as { from?: unknown; to?: unknown }) ?? {};
            if (!isPosition(from) || !isPosition(to)) return;
            const result = session.requestMove(auth.userId, from, to);
            if (!result.ok)
              client.send(ACTION_REJECTED, { error: result.error });
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
      client.send('init', { color: null, state: session.getPublicState() });
      return;
    }
    const color = session.addPlayer(auth.userId, client);
    client.send('init', { color, state: session.getPublicState() });
    if (!color) return;
    if (auth.mode === 'single') session.enableBot(color);
    client.send('state', session.getPublicState());
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
