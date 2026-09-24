import {
  answerPayloadSchema,
  type TriviaQuizServerMessage,
} from '@marquinhos/contracts/activity/games/triviaQuiz';
import { TriviaQuizSession } from 'services/activity/trivia-quiz/TriviaQuizSession';
import { GamificationService } from 'services/gamification/GamificationService';
import type { AdapterContext, GameRoomAdapter } from '../GameRoomAdapter';
import { sendMessage } from '../sendMessage';

const ANSWER_RATE_LIMIT_WINDOW_MS = 1000;
const ANSWER_RATE_LIMIT_MAX = 1;

export const triviaQuizAdapter: GameRoomAdapter<TriviaQuizSession> = {
  maxPlayers: 2,
  supportsBot: false,
  supportsQueue: false,

  setup(ctx: AdapterContext) {
    const session = new TriviaQuizSession(
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
      new GamificationService(),
    );

    return {
      session,
      messageHandlers: {
        answer: {
          rateLimit: {
            windowMs: ANSWER_RATE_LIMIT_WINDOW_MS,
            max: ANSWER_RATE_LIMIT_MAX,
          },
          handle: (auth, _client, payload: unknown) => {
            const parsed = answerPayloadSchema.safeParse(payload);
            if (!parsed.success) return;
            session.handleAnswer(
              auth.userId,
              parsed.data.answerIndex,
              Date.now(),
            );
          },
        },
        leave: { handle: (auth, client) => session.leave(auth.userId, client) },
      },
    };
  },

  onJoin(session, auth, client, seat) {
    if (seat === 'player' && !session.addPlayer(auth.userId, client)) {
      sendMessage<TriviaQuizServerMessage>(client, {
        type: 'error',
        payload: { message: 'Game is full' },
      });
      client.leave();
      return;
    }
    sendMessage<TriviaQuizServerMessage>(client, {
      type: 'init',
      payload: {
        playerScores: session.getPublicPlayerScores(),
        leaderboard: session.getLeaderboard(),
      },
    });
    const question = session.getPublicState();
    if (question) {
      sendMessage<TriviaQuizServerMessage>(client, {
        type: 'state_update',
        payload: question,
      });
    } else if (seat === 'player' && session.getState().players.size === 2) {
      session.start();
    }
  },
  onLeave(session, auth, client) {
    session.pauseForDisconnect(auth.userId, client);
  },
  onDispose(session) {
    session.dispose();
  },
};
