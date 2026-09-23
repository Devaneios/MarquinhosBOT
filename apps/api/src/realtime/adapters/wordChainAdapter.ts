import {
  wordPayloadSchema,
  type WordChainServerMessage,
} from '@marquinhos/contracts/activity/games/wordChain';
import { ACTION_REJECTED } from '@marquinhos/contracts/activity/protocol';
import { WordChainSession } from 'services/activity/word-chain/WordChainSession';
import type { AdapterContext, GameRoomAdapter } from '../GameRoomAdapter';
import { sendMessage } from '../sendMessage';

const WORD_RATE_LIMIT_WINDOW_MS = 1000;
const WORD_RATE_LIMIT_MAX = 3;

export const wordChainAdapter: GameRoomAdapter<WordChainSession> = {
  maxPlayers: 2,
  supportsBot: true,
  supportsQueue: false,

  setup(ctx: AdapterContext) {
    const session = new WordChainSession(
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
      { onSessionEnded: ctx.onSessionEnded },
    );

    return {
      session,
      messageHandlers: {
        word: {
          rateLimit: {
            windowMs: WORD_RATE_LIMIT_WINDOW_MS,
            max: WORD_RATE_LIMIT_MAX,
          },
          handle: (auth, client, payload: unknown) => {
            const parsed = wordPayloadSchema.safeParse(payload);
            if (!parsed.success) {
              sendMessage<WordChainServerMessage>(client, {
                type: ACTION_REJECTED,
                payload: { error: 'Invalid word' },
              });
              return;
            }
            const result = session.handleWordSubmission(
              auth.userId,
              parsed.data.word,
            );
            if (!result.ok)
              sendMessage<WordChainServerMessage>(client, {
                type: ACTION_REJECTED,
                payload: { error: result.error },
              });
          },
        },
        leave: { handle: (auth, client) => session.leave(auth.userId, client) },
      },
    };
  },

  onJoin(session, auth, client, seat) {
    // WordChainSession.addPlayer() has no seat-capacity check of its own —
    // unlike CardTable/Dominoes/Snake/TowerUnstable (whose internal cap
    // equals maxPlayers, making a spectator's addPlayer call a guaranteed
    // no-op), it unconditionally pushes the caller onto `this.players` and
    // `engine.addPlayer()`, which enrolls them in `state.players` and the
    // turn order — exactly the MinesweeperSession/TriviaQuizSession shape.
    // Calling it for a non-player seat would silently seat a spectator as a
    // real turn-taking participant, so a non-player only ever gets the
    // one-time state snapshot as an ack, never addPlayer().
    if (seat === 'player') {
      session.addPlayer(auth.userId, client);
      if (auth.mode === 'single') session.enableBot();
    }
    sendMessage<WordChainServerMessage>(client, {
      type: 'init',
      payload: session.getPublicState(),
    });
  },
  onLeave(session, auth, client) {
    session.pauseForDisconnect(auth.userId, client);
  },
  onDispose(session) {
    session.dispose();
  },
};
