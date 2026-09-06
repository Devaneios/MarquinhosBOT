import type { Cell } from 'services/activity/word-search-race/WordSearchRaceEngine';
import { WordSearchRaceSession } from 'services/activity/word-search-race/WordSearchRaceSession';
import type { AdapterContext, GameRoomAdapter } from '../GameRoomAdapter';

const SELECT_RATE_LIMIT_WINDOW_MS = 1000;
const SELECT_RATE_LIMIT_MAX = 10;

function isValidCell(value: unknown): value is Cell {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Cell).row === 'number' &&
    typeof (value as Cell).col === 'number' &&
    Number.isInteger((value as Cell).row) &&
    Number.isInteger((value as Cell).col)
  );
}

export const wordSearchRaceAdapter: GameRoomAdapter<WordSearchRaceSession> = {
  // WordSearchRaceSession.addPlayer() has no internal player-count cap —
  // it's an unconditional `this.players.push()` — same shape as
  // WordleRaceSession/BoggleSession, whose adapters already use this same
  // 8-seat convention so MatchRoom's seat assignment has a real limit to
  // enforce.
  maxPlayers: 8,
  supportsBot: false,
  supportsQueue: false,

  setup(ctx: AdapterContext) {
    const session = new WordSearchRaceSession(
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
        select: {
          rateLimit: {
            windowMs: SELECT_RATE_LIMIT_WINDOW_MS,
            max: SELECT_RATE_LIMIT_MAX,
          },
          handle: (auth, client, payload: unknown) => {
            const { start, end } =
              (payload as { start?: unknown; end?: unknown }) ?? {};
            if (!isValidCell(start) || !isValidCell(end)) {
              client.send('select_error', { message: 'Invalid selection' });
              return;
            }
            const result = session.submitSelection(auth.userId, start, end);
            if ('error' in result)
              client.send('select_error', { message: result.error });
          },
        },
        leave: {
          handle: (auth, client) => session.removePlayer(auth.userId, client),
        },
      },
    };
  },

  onJoin(session, auth, client, seat) {
    // WordSearchRaceSession.addPlayer() has no seat-capacity check of its
    // own and unconditionally enrolls the caller into `this.players` —
    // which `recordResult()` iterates to build the gamification ranking
    // sent at game end, and which keeps the empty-room grace timer from
    // ever firing (`removePlayer()` only disposes once `this.players` is
    // empty). Calling it for a non-player seat would silently score a
    // spectator in the final results and could keep a room alive forever
    // after every real player has left, so a non-player seat only ever
    // gets a one-time ack, never addPlayer(). `getPublicState()` carries no
    // per-user data (grid/words/found/scores/deadline/ended are shared
    // state), so it's a safe, correct ack for both cases.
    if (seat !== 'player') {
      client.send('init', session.getPublicState());
      return;
    }
    session.addPlayer(auth.userId, client);
    client.send('init', session.getPublicState());
  },
  onLeave(session, auth, client) {
    session.removePlayer(auth.userId, client);
  },
  onDispose(session) {
    session.dispose();
  },
};
