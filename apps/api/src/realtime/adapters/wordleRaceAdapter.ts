import { ACTION_REJECTED } from 'services/activity/shared/ActionResult';
import { WordleRaceSession } from 'services/activity/wordle-race/WordleRaceSession';
import type { AdapterContext, GameRoomAdapter } from '../GameRoomAdapter';

const GUESS_RATE_LIMIT_WINDOW_MS = 1000;
const GUESS_RATE_LIMIT_MAX = 3;

export const wordleRaceAdapter: GameRoomAdapter<WordleRaceSession> = {
  // WordleRaceSession.addPlayer()/WordleRaceEngine.addPlayer() have no
  // internal player-count cap of their own (just an unconditional Map.set) —
  // same shape as BoggleSession, which also has no session-side cap and
  // uses this same 8-seat convention so MatchRoom's seat assignment has a
  // real limit to enforce.
  maxPlayers: 8,
  supportsBot: false,
  supportsQueue: false,

  setup(ctx: AdapterContext) {
    const session = new WordleRaceSession(
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
        guess: {
          rateLimit: {
            windowMs: GUESS_RATE_LIMIT_WINDOW_MS,
            max: GUESS_RATE_LIMIT_MAX,
          },
          handle: (auth, client, payload: unknown) => {
            const guess = (payload as { guess?: string })?.guess ?? '';
            // WordleRaceEngine.submitGuess() calls `guess.trim().toLowerCase()`
            // unconditionally — a non-string `guess` (e.g. a number or object
            // surviving the `?? ''` above, which only replaces null/undefined)
            // would throw a TypeError from inside the engine instead of
            // returning a clean rejection. Guard here, matching
            // wordChainAdapter's fix and this adapter's own `!result.ok`
            // rejection shape.
            if (typeof guess !== 'string') {
              client.send(ACTION_REJECTED, { error: 'Invalid guess' });
              return;
            }
            const result = session.submitGuess(auth.userId, guess);
            if (!result.ok)
              client.send(ACTION_REJECTED, { error: result.error });
          },
        },
        leave: { handle: (auth, client) => session.leave(auth.userId, client) },
      },
    };
  },

  onJoin(session, auth, client, seat) {
    // WordleRaceSession.addPlayer() has no seat-capacity check of its own
    // and unconditionally enrolls the caller via `engine.addPlayer()` into
    // `state.players` — a spectator who never submits a guess would sit
    // there forever unsolved/unexhausted, which permanently blocks
    // `isGameOver()` (it requires every enrolled player to be solved or
    // exhausted). So a non-player seat only ever gets a one-time ack; it
    // never calls addPlayer(). `getGameState()` degrades safely for a
    // userId that was never added — `players.get()` returns undefined and
    // the `currentPlayer*` fields fall back to their empty/false defaults —
    // so it's the correct call for both cases.
    if (seat !== 'player') {
      client.send('init', session.getGameState(auth.userId));
      return;
    }
    session.addPlayer(auth.userId, client);
    client.send('init', session.getGameState(auth.userId));
  },
  onLeave(session, auth, client) {
    session.pauseForDisconnect(auth.userId, client);
  },
  onDispose(session) {
    session.dispose();
  },
};
