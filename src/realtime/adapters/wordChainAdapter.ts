import { ACTION_REJECTED } from 'services/activity/shared/ActionResult';
import { WordChainSession } from 'services/activity/word-chain/WordChainSession';
import type { AdapterContext, GameRoomAdapter } from '../GameRoomAdapter';

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
            const word = (payload as { word?: string })?.word ?? '';
            // WordChainEngine.submitWord() calls `word.trim().toLowerCase()`
            // unconditionally — a non-string `word` (e.g. a number or
            // object surviving the `?? ''` above, which only replaces
            // null/undefined) would throw a TypeError from inside the
            // engine instead of returning a clean rejection. Guard here,
            // matching this adapter's own `!result.ok` rejection shape.
            if (typeof word !== 'string') {
              client.send(ACTION_REJECTED, { error: 'Invalid word' });
              return;
            }
            const result = session.handleWordSubmission(auth.userId, word);
            if (!result.ok)
              client.send(ACTION_REJECTED, { error: result.error });
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
    const state = session.state;
    client.send('init', {
      currentWord: state.currentWord,
      currentTurn: state.currentTurn,
      usedWords: Array.from(state.usedWords),
      players: state.players,
      gameOver: state.gameOver,
      winner: state.winner,
    });
  },
  onLeave(session, auth, client) {
    session.pauseForDisconnect(auth.userId, client);
  },
  onDispose(session) {
    session.dispose();
  },
};
