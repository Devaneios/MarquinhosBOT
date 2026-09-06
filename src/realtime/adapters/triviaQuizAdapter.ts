import { TriviaQuizSession } from 'services/activity/trivia-quiz/TriviaQuizSession';
import { GamificationService } from 'services/gamification/GamificationService';
import type { AdapterContext, GameRoomAdapter } from '../GameRoomAdapter';

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
            const answerIndex =
              (payload as { answerIndex?: number })?.answerIndex ?? -1;
            if (typeof answerIndex !== 'number' || answerIndex < 0) return;
            session.handleAnswer(auth.userId, answerIndex, Date.now());
          },
        },
        leave: { handle: (auth, client) => session.leave(auth.userId, client) },
      },
    };
  },

  onJoin(session, auth, client, seat) {
    if (seat !== 'player') {
      client.send('init', {
        playerScores: session.getPublicPlayerScores(),
        leaderboard: session.getLeaderboard(),
      });
      return;
    }
    const joined = session.addPlayer(auth.userId, client);
    if (!joined) {
      client.send('error', { message: 'Game is full' });
      client.leave();
      return;
    }
    client.send('init', {
      playerScores: session.getPublicPlayerScores(),
      leaderboard: session.getLeaderboard(),
    });
    if (session.getState().players.size === 2) session.start();
  },
  onLeave(session, auth, client) {
    session.pauseForDisconnect(auth.userId, client);
  },
  onDispose(session) {
    session.dispose();
  },
};
