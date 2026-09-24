import type { BingoSpeedServerMessage } from '@marquinhos/contracts/activity/games/bingoSpeed';
import { BingoSpeedSession } from 'services/activity/bingoSpeed/BingoSpeedSession';
import type { AdapterContext, GameRoomAdapter } from '../GameRoomAdapter';
import { sendMessage } from '../sendMessage';

const CLAIM_RATE_LIMIT_WINDOW_MS = 1000;
const CLAIM_RATE_LIMIT_MAX = 5;

export const bingoSpeedAdapter: GameRoomAdapter<BingoSpeedSession> = {
  // Matches BingoSpeedSession.addPlayer's own internal cap (`this.players.size
  // >= 4`) so MatchRoom's generic seat assignment agrees with the session's
  // limit instead of guessing.
  maxPlayers: 4,
  supportsBot: false,
  supportsQueue: false,

  setup(ctx: AdapterContext) {
    const session = new BingoSpeedSession(
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
        claim_bingo: {
          rateLimit: {
            windowMs: CLAIM_RATE_LIMIT_WINDOW_MS,
            max: CLAIM_RATE_LIMIT_MAX,
          },
          handle: (auth, client) => {
            const result = session.claimBingo(auth.userId);
            sendMessage<BingoSpeedServerMessage>(client, {
              type: 'bingo_claim_result',
              payload: result,
            });
          },
        },
        leave: { handle: (auth, client) => session.leave(auth.userId, client) },
      },
    };
  },

  onJoin(session, auth, client, seat) {
    if (seat !== 'player') {
      sendMessage<BingoSpeedServerMessage>(client, {
        type: 'init',
        payload: { card: null, state: session.getPublicState() },
      });
      return;
    }
    const card = session.addPlayer(auth.userId, client);
    const state = session.getPublicState();
    sendMessage<BingoSpeedServerMessage>(client, {
      type: 'init',
      payload: { card, state },
    });
    if (session.playerCount >= 2 && auth.mode === 'multi') session.start();
  },
  onLeave(session, auth, client) {
    session.pauseForDisconnect(auth.userId, client);
  },
  onDispose(session) {
    session.dispose();
  },
};
