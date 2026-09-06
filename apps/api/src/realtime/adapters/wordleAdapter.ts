import type { Client } from 'colyseus';
import type { WsSessionPayload } from 'services/activity/wsSessionToken';
import { WordleService } from 'services/wordle';
import type {
  AdapterContext,
  GameRoomAdapter,
  SeatRole,
} from '../GameRoomAdapter';

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
            const guess = (payload as { guess?: string })?.guess ?? '';
            // WordleService.submitGuess() -> resolveCanonical() calls
            // `guess.trim().toLowerCase()` unconditionally, so a non-string
            // `guess` (e.g. a number or object surviving the `?? ''` above,
            // which only replaces null/undefined) would throw a TypeError
            // from inside the service instead of returning a clean
            // rejection. Guard here, matching wordChainAdapter's/
            // wordleRaceAdapter's fix and this adapter's own `guess_error`
            // rejection shape (the original WordleRoom's shape too).
            if (typeof guess !== 'string') {
              client.send('guess_error', { message: 'Invalid guess' });
              return;
            }
            const result = service.submitGuess(
              auth.userId,
              auth.guildId,
              guess,
            );
            if ('error' in result) {
              client.send('guess_error', { message: result.error });
              return;
            }
            client.send('guess_result', result);
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
      client.send('init', {
        wordLength: daily.word.length,
        guesses: [],
        solved: false,
        attempts: 0,
      });
      return;
    }
    const daily = service.getDailyWord(auth.guildId);
    const userSession = service.getUserSession(auth.userId, auth.guildId);
    client.send('init', {
      wordLength: daily.word.length,
      guesses: userSession?.guesses ?? [],
      solved: userSession?.solved ?? false,
      attempts: userSession?.attempts ?? 0,
    });
  },
  onLeave() {
    // The original WordleRoom.onLeave only cleared its rate limiter — that's
    // handled generically by MatchRoom's per-message-type RateLimiter now,
    // so there is nothing game-specific left to do here. WordleRoom also
    // never registered a `leave` message handler (only `guess`), so there's
    // no message-level cleanup to port either — see wordleAdapter's
    // investigation notes in the task-20 report.
  },
  onDispose() {
    // The original WordleRoom has no onDispose at all.
  },
};
