import {
  clientMessageSchema,
  guessPayloadSchema,
  type WordleServerMessage,
} from '@marquinhos/contracts/activity/games/wordle';
import type { Client } from 'colyseus';
import { logger } from 'common/logging/logger';
import type { WsSessionPayload } from 'modules/activity/ws-session-token';
import { WordleService } from 'modules/wordle/wordle.service';
import type {
  AdapterContext,
  GameRoomAdapter,
  SeatRole,
} from '../GameRoomAdapter';
import type { RoomDependencies } from '../room-dependencies';
import { sendMessage } from '../sendMessage';

const GUESS_RATE_LIMIT_WINDOW_MS = 1000;
const GUESS_RATE_LIMIT_MAX = 3;

const DAY_CHANGED_MESSAGE =
  'O dia do jogo mudou. O tabuleiro foi atualizado para a palavra de hoje.';

const recordedDatesByService = new WeakMap<
  WordleService,
  WeakMap<Client, string>
>();
const seatsByClient = new WeakMap<Client, SeatRole>();
const initializationsByClient = new WeakMap<Client, Promise<void>>();

function getRecordedDates(service: WordleService): WeakMap<Client, string> {
  let map = recordedDatesByService.get(service);
  if (!map) {
    map = new WeakMap();
    recordedDatesByService.set(service, map);
  }
  return map;
}

async function sendInit(
  service: WordleService,
  auth: WsSessionPayload,
  client: Client,
  seat: SeatRole,
  syncOnly = false,
): Promise<void> {
  // Presence and achievements are side effects of joining: a failure in
  // either must not keep the player out of the game.
  const initDate = service.currentDate();
  if (seat === 'player' && getRecordedDates(service).get(client) !== initDate) {
    await service
      .recordParticipation(auth.userId, auth.guildId)
      .then(() => {
        getRecordedDates(service).set(client, initDate);
      })
      .catch((error: unknown) => {
        logger.error('wordle.presence_failed', {
          error,
          userId: auth.userId,
          guildId: auth.guildId,
        });
      });
  }
  const overview = service
    .refreshAchievements(auth.userId, auth.guildId)
    .catch((error: unknown) => {
      logger.error('wordle.achievements.overview_failed', {
        error,
        userId: auth.userId,
        guildId: auth.guildId,
      });
      return undefined;
    });
  // Non-player seats: maxPlayers: 64 makes them effectively unreachable via
  // normal simultaneous joins, but MatchRoom.switchGame() re-seats every
  // currently-connected client against the *new* adapter's maxPlayers
  // when a room switches into wordle — a room that organically
  // accumulated 65+ clients under a different (uncapped) game produces
  // real non-player seats here, no simultaneity required. WordleService
  // has no player-registration concept to skip for a spectator, so
  // there's no harm in reading state for them — they get the same ack
  // shape a real player gets, with an empty session, instead of no ack.
  const [daily, userSession, achievementState, draft] = await Promise.all([
    service.getDailyWord(auth.guildId),
    seat === 'player'
      ? service.getUserSession(auth.userId, auth.guildId)
      : null,
    overview,
    seat === 'player' ? service.getUserDraft(auth.userId, auth.guildId) : null,
  ]);
  sendMessage<WordleServerMessage>(client, {
    type: 'init',
    payload: {
      wordLength: daily.word.length,
      date: daily.word_date,
      guesses: userSession?.guesses ?? [],
      solved: userSession?.solved ?? false,
      attempts: userSession?.attempts ?? 0,
      draft,
      ...(syncOnly ? { syncOnly: true } : {}),
      ...(achievementState
        ? {
            achievementOverview: achievementState.overview,
            achievementPending: achievementState.pending,
          }
        : {}),
    },
  });
}

/**
 * Bind authenticated room messages to the shared daily Wordle service. Only admitted
 * players can submit guesses and drafts. Accepted writes persist across surfaces,
 * while stale round messages trigger a refreshed snapshot. Gameplay rejections use
 * protocol error messages. Service failures propagate to the room's async handler.
 */
export const wordleAdapter: GameRoomAdapter<WordleService> = {
  // Every player solves their own private daily puzzle — there is no shared
  // 2-player match to cap, so this is set high enough that MatchRoom's
  // generic seat assignment always seats everyone as 'player'.
  maxPlayers: 64,
  supportsBot: false,
  supportsQueue: false,

  setup(_ctx: AdapterContext, dependencies: RoomDependencies) {
    const service = dependencies.wordle;
    const recordedDates = getRecordedDates(service);
    return {
      session: service,
      messageHandlers: {
        wordle_sync: {
          rateLimit: { windowMs: 1000, max: 2 },
          handle: async (auth, client) => {
            await initializationsByClient.get(client)?.catch(() => undefined);
            const seat = seatsByClient.get(client);
            if (seat) await sendInit(service, auth, client, seat, true);
          },
        },
        achievement_refresh: {
          rateLimit: { windowMs: 1000, max: 2 },
          handle: async (auth, client, payload) => {
            const parsed = clientMessageSchema.safeParse({
              type: 'achievement_refresh',
              payload,
            });
            if (!parsed.success || parsed.data.type !== 'achievement_refresh')
              return;
            const refreshed = await service.refreshAchievements(
              auth.userId,
              auth.guildId,
            );
            sendMessage<WordleServerMessage>(client, {
              type: 'achievement_refresh_result',
              payload: {
                requestId: parsed.data.payload.requestId,
                ...refreshed,
              },
            });
          },
        },
        guess: {
          rateLimit: {
            windowMs: GUESS_RATE_LIMIT_WINDOW_MS,
            max: GUESS_RATE_LIMIT_MAX,
          },
          handle: async (
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
            // A board left open across midnight still shows yesterday: send
            // today's board instead of applying the guess to a word the
            // player has not seen.
            if (
              parsed.data.date !== undefined &&
              parsed.data.date !== service.currentDate()
            ) {
              if (parsed.data.requestId) {
                const replay = await service.replayGuess(
                  auth.userId,
                  auth.guildId,
                  parsed.data.date,
                  parsed.data.guess,
                  parsed.data.requestId,
                );
                if (replay && !('error' in replay)) {
                  sendMessage<WordleServerMessage>(client, {
                    type: 'guess_result',
                    payload: replay,
                  });
                  await sendInit(service, auth, client, 'player');
                  return;
                }
                if (replay && 'error' in replay) {
                  await sendInit(service, auth, client, 'player');
                  sendMessage<WordleServerMessage>(client, {
                    type: 'guess_error',
                    payload: {
                      message: replay.error,
                      requestId: parsed.data.requestId,
                    },
                  });
                  return;
                }
              }
              await sendInit(service, auth, client, 'player');
              sendMessage<WordleServerMessage>(client, {
                type: 'guess_error',
                payload: {
                  message: DAY_CHANGED_MESSAGE,
                  requestId: parsed.data.requestId,
                },
              });
              return;
            }
            const result = await service.submitGuess(
              auth.userId,
              auth.guildId,
              parsed.data.guess,
              parsed.data.captureAchievementBaseline,
              parsed.data.requestId,
            );
            if ('error' in result) {
              sendMessage<WordleServerMessage>(client, {
                type: 'guess_error',
                payload: {
                  message: result.error,
                  requestId: parsed.data.requestId,
                },
              });
              await sendInit(service, auth, client, 'player', true);
              return;
            }
            sendMessage<WordleServerMessage>(client, {
              type: 'guess_result',
              payload: result,
            });
          },
        },
        draft_update: {
          rateLimit: { windowMs: 1000, max: 40 },
          handle: async (auth, client, payload) => {
            const parsed = clientMessageSchema.safeParse({
              type: 'draft_update',
              payload,
            });
            if (!parsed.success || parsed.data.type !== 'draft_update') {
              sendMessage<WordleServerMessage>(client, {
                type: 'draft_result',
                payload: { status: 'closed' },
              });
              return;
            }
            const { requestId, ...draft } = parsed.data.payload;
            if (draft.date !== service.currentDate()) {
              await sendInit(service, auth, client, 'player');
              return;
            }
            const shouldRecordParticipation =
              recordedDates.get(client) !== draft.date;
            const result = await service.writeDraft(
              auth.userId,
              auth.guildId,
              draft,
              { recordParticipation: shouldRecordParticipation },
            );
            if (shouldRecordParticipation && result.status === 'saved') {
              recordedDates.set(client, draft.date);
            }
            sendMessage<WordleServerMessage>(client, {
              type: 'draft_result',
              payload: { ...result, requestId },
            });
          },
        },
      },
    };
  },

  onJoin: (service, auth, client, seat: SeatRole) => {
    seatsByClient.set(client, seat);
    const initialization = sendInit(service, auth, client, seat);
    initializationsByClient.set(client, initialization);
    return initialization;
  },
  onLeave: (_service, _auth, client) => {
    seatsByClient.delete(client);
    initializationsByClient.delete(client);
  },
  onDispose: () => undefined,
};
