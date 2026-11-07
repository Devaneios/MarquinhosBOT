import {
  guessPayloadSchema,
  type HangmanServerMessage,
} from '@marquinhos/contracts/activity/games/hangman';
import { HangmanSession } from 'modules/activity/games/hangman/hangman-session';
import { getHangmanWord } from 'modules/activity/games/hangman/word-list';
import type { AdapterContext, GameRoomAdapter } from '../GameRoomAdapter';
import type { RoomDependencies } from '../room-dependencies';
import { sendMessage } from '../sendMessage';

const GUESS_RATE_LIMIT_WINDOW_MS = 1000;
const GUESS_RATE_LIMIT_MAX = 3;

export const hangmanAdapter: GameRoomAdapter<HangmanSession> = {
  maxPlayers: 2,
  supportsBot: false,
  supportsQueue: false,

  setup(ctx: AdapterContext, dependencies: RoomDependencies) {
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
      dependencies.gamification,
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
            const parsed = guessPayloadSchema.safeParse(payload);
            if (!parsed.success) {
              sendMessage<HangmanServerMessage>(client, {
                type: 'guess_error',
                payload: { message: 'Invalid letter' },
              });
              return;
            }
            const result = session.guessLetter(auth.userId, parsed.data.letter);
            if (!result.success) {
              sendMessage<HangmanServerMessage>(client, {
                type: 'guess_error',
                payload: { message: result.message },
              });
              return;
            }
            sendMessage<HangmanServerMessage>(client, {
              type: 'guess_success',
              payload: {},
            });
          },
        },
      },
    };
  },

  onJoin(session, auth, client, seat) {
    // Hangman has no spectator concept, so an overflow joiner is kicked outright,
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
    sendMessage<HangmanServerMessage>(client, {
      type: 'init',
      payload: session.getState(),
    });
  },

  onLeave(session, auth, client) {
    session.pauseForDisconnect(auth.userId, client);
  },

  onDispose(session) {
    session.dispose();
  },
};
