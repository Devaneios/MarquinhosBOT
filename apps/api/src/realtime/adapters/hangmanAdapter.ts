import { HangmanSession } from 'services/activity/hangman/HangmanSession';
import { getHangmanWord } from 'services/activity/hangman/wordList';
import type { AdapterContext, GameRoomAdapter } from '../GameRoomAdapter';

const GUESS_RATE_LIMIT_WINDOW_MS = 1000;
const GUESS_RATE_LIMIT_MAX = 3;

export const hangmanAdapter: GameRoomAdapter<HangmanSession> = {
  maxPlayers: 2,
  supportsBot: false,
  supportsQueue: false,

  setup(ctx: AdapterContext) {
    const session = new HangmanSession(
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
      getHangmanWord(),
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
            const letter = (payload as { letter?: string })?.letter ?? '';
            const result = session.guessLetter(auth.userId, letter);
            if (!result.success) {
              client.send('guess_error', { message: result.message });
              return;
            }
            client.send('guess_success', {});
          },
        },
      },
    };
  },

  onJoin(session, auth, client, seat) {
    // Matches HangmanRoom.onJoin's original behavior exactly: Hangman never
    // had a spectator concept, so an overflow joiner is kicked outright,
    // same as `addPlayer` returning false.
    if (seat !== 'player') {
      client.leave(1008, 'Room is full');
      return;
    }
    const added = session.addPlayer(auth.userId, client);
    if (!added) {
      client.leave(1008, 'Room is full');
      return;
    }
    client.send('init', session.getState());
  },

  onLeave(session, auth, client) {
    session.pauseForDisconnect(auth.userId, client);
  },

  onDispose(session) {
    session.dispose();
  },
};
