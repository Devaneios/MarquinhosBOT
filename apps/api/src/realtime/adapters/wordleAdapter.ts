import {
  guessPayloadSchema,
  type WordleServerMessage,
} from '@marquinhos/contracts/activity/games/wordle';
import type { Client } from 'colyseus';
import type { WsSessionPayload } from 'services/activity/wsSessionToken';
import { WordleService } from 'services/wordle';
import type {
  AdapterContext,
  GameRoomAdapter,
  SeatRole,
} from '../GameRoomAdapter';
import { sendMessage } from '../sendMessage';

const GUESS_RATE_LIMIT_WINDOW_MS = 1000;
const GUESS_RATE_LIMIT_MAX = 3;

export const wordleAdapter: GameRoomAdapter<WordleService> = {
  // Every player solves their own private daily puzzle — there is no shared
  // 2-player match to cap, so this is set high enough that MatchRoom's
  // generic seat assignment always seats everyone as 'player'.
  maxPlayers: 64,
  supportsBot: false,
  supportsQueue: false,

  setup(_ctx: AdapterContext) {
    const service = new WordleService();
    return {
      session: service,
      messageHandlers: {
        guess: {
          rateLimit: {
            windowMs: GUESS_RATE_LIMIT_WINDOW_MS,
            max: GUESS_RATE_LIMIT_MAX,
          },
          handle: (
            auth: WsSessionPayload,
            client: Client,
            payload: unknown,
          ) => {
            const parsed = guessPayloadSchema.safeParse(payload);
            if (!parsed.success) {
              sendMessage<WordleServerMessage>(client, {
                type: 'guess_error',
                payload: { message: 'Invalid guess' },
              });
              return;
            }
            const result = service.submitGuess(
              auth.userId,
              auth.guildId,
              parsed.data.guess,
            );
            if ('error' in result) {
              sendMessage<WordleServerMessage>(client, {
                type: 'guess_error',
                payload: { message: result.error },
              });
              return;
            }
            sendMessage<WordleServerMessage>(client, {
              type: 'guess_result',
              payload: result,
            });
          },
        },
      },
    };
  },

  onJoin(service, auth, client, seat: SeatRole) {
    // maxPlayers: 64 makes this branch effectively unreachable via normal
    // simultaneous joins, but MatchRoom.switchGame() re-seats every
    // currently-connected client against the *new* adapter's maxPlayers
    // when a room switches into wordle — a room that organically
    // accumulated 65+ clients under a different (uncapped) game produces
    // real non-player seats here, no simultaneity required. WordleService
    // has no player-registration concept to skip for a spectator, so
    // there's no harm in reading state for them — just send the same ack
    // shape a real player gets (with the same safe defaults used in the
    // player branch below) instead of leaving them without any ack at all.
    if (seat !== 'player') {
      const daily = service.getDailyWord(auth.guildId);
      sendMessage<WordleServerMessage>(client, {
        type: 'init',
        payload: {
          wordLength: daily.word.length,
          guesses: [],
          solved: false,
          attempts: 0,
        },
      });
      return;
    }
    const daily = service.getDailyWord(auth.guildId);
    const userSession = service.getUserSession(auth.userId, auth.guildId);
    sendMessage<WordleServerMessage>(client, {
      type: 'init',
      payload: {
        wordLength: daily.word.length,
        guesses: userSession?.guesses ?? [],
        solved: userSession?.solved ?? false,
        attempts: userSession?.attempts ?? 0,
      },
    });
  },
  onLeave() {},
  onDispose() {},
};
