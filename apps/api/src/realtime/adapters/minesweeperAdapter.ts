import {
  revealRequestSchema,
  type MinesweeperServerMessage,
} from '@marquinhos/contracts/activity/games/minesweeperVersus';
import { MinesweeperSession } from 'services/activity/minesweeper/MinesweeperSession';
import type { AdapterContext, GameRoomAdapter } from '../GameRoomAdapter';
import { sendMessage } from '../sendMessage';

const REVEAL_RATE_LIMIT_WINDOW_MS = 1000;
const REVEAL_RATE_LIMIT_MAX = 20;

export const minesweeperAdapter: GameRoomAdapter<MinesweeperSession> = {
  maxPlayers: 2,
  supportsBot: false,
  supportsQueue: false,

  setup(ctx: AdapterContext) {
    const session = new MinesweeperSession(
      {
        sessionKey: ctx.roomKey,
        instanceId: ctx.instanceId,
        guildId: ctx.guildId,
      },
      {
        broadcast: (_key, message) =>
          ctx.broadcast(message.type, message.payload),
      },
      undefined,
      undefined,
      { onSessionEnded: ctx.onSessionEnded },
    );

    return {
      session,
      messageHandlers: {
        reveal: {
          rateLimit: {
            windowMs: REVEAL_RATE_LIMIT_WINDOW_MS,
            max: REVEAL_RATE_LIMIT_MAX,
          },
          handle: (auth, client, payload: unknown) => {
            const parsed = revealRequestSchema.safeParse(payload);
            if (!parsed.success) {
              sendMessage<MinesweeperServerMessage>(client, {
                type: 'reveal_error',
                payload: { message: 'Invalid tile coordinates' },
              });
              return;
            }
            const result = session.reveal(
              auth.userId,
              parsed.data.x,
              parsed.data.y,
            );
            if ('error' in result)
              sendMessage<MinesweeperServerMessage>(client, {
                type: 'reveal_error',
                payload: { message: result.error },
              });
          },
        },
      },
    };
  },

  onJoin(session, auth, client, seat) {
    // Unlike CardTableSession/DominoesSession, MinesweeperSession.addPlayer()
    // has no seat-capacity check or internal spectator routing — it
    // unconditionally pushes the caller onto `this.players`, which is
    // exactly what `reveal()` checks to authorize a tile click and what
    // `recordResult()` iterates for gamification scoring. Calling it for a
    // non-player seat would silently let a spectator reveal tiles and be
    // scored as if they were a real participant, so a non-player only gets
    // the one-time board snapshot as a minimal ack, never addPlayer().
    if (seat === 'player') session.addPlayer(auth.userId, client);
    sendMessage<MinesweeperServerMessage>(client, {
      type: 'init',
      payload: session.getBoardSnapshot(),
    });
  },
  onLeave(session, auth, client) {
    session.removeConnection(auth.userId, client);
  },
  onDispose(session) {
    session.dispose();
  },
};
