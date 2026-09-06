import { ACTION_REJECTED } from 'services/activity/shared/ActionResult';
import { TowerSession } from 'services/activity/towerUnstable/TowerSession';
import type { AdapterContext, GameRoomAdapter } from '../GameRoomAdapter';

const PULL_RATE_LIMIT_WINDOW_MS = 1000;
const PULL_RATE_LIMIT_MAX = 5;

// TowerEngine.pull()'s bounds checks (`level < 0 || level >= length`,
// `position < 0 || position >= blocksPerLevel`) are plain relational
// comparisons: a non-numeric or NaN-producing value coerces to `false` on
// both sides, so it slips past them, and past `isEligibleLevel()`'s own `<`
// check too — those are all safe dead ends that just fall through to a
// rejection. But a well-typed *non-integer* number (e.g. `level: 3.5`) sails
// through every one of those checks and then hits `this.levels[level]`,
// which array-indexes with a non-canonical key and returns `undefined` —
// the next `.blocks` access throws a TypeError with nothing upstream to
// catch it (verified directly against TowerEngine: `engine.pull('a', 3.5,
// 0)` throws "undefined is not an object (evaluating
// 'this.levels[level].blocks')"). Reject anything that isn't a genuine
// integer before it ever reaches `session.handlePull`.
function isValidCoordinate(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

export const towerUnstableAdapter: GameRoomAdapter<TowerSession> = {
  maxPlayers: 2,
  supportsBot: true,
  supportsQueue: false,

  setup(ctx: AdapterContext) {
    const session = new TowerSession(
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
        pull: {
          rateLimit: {
            windowMs: PULL_RATE_LIMIT_WINDOW_MS,
            max: PULL_RATE_LIMIT_MAX,
          },
          handle: (auth, client, payload: unknown) => {
            const { level, position } =
              (payload as { level?: unknown; position?: unknown }) ?? {};
            if (!isValidCoordinate(level) || !isValidCoordinate(position)) {
              client.send(ACTION_REJECTED, {
                error: 'Invalid pull coordinates',
              });
              return;
            }
            const result = session.handlePull(auth.userId, level, position);
            if (!result.ok)
              client.send(ACTION_REJECTED, { error: result.error });
          },
        },
        restart: { handle: (auth) => session.requestRestart(auth.userId) },
        leave: { handle: (auth, client) => session.leave(auth.userId, client) },
      },
    };
  },

  onJoin(session, auth, client, seat, ctx) {
    // TowerSession.addPlayer() has its own capacity check
    // (`this.players.length >= MAX_PLAYERS`), independent of MatchRoom's own
    // seat bookkeeping — the same shape as SnakeSession.addPlayer(), not
    // MinesweeperSession's (which has no cap and would let a spectator's
    // addPlayer call actually enroll them as a real participant).
    // MatchRoom.assignSeat() only ever hands out a non-'player' role once
    // `maxPlayers` members already hold 'player', and onJoin runs
    // synchronously in seat-assignment order, so by the time a non-player's
    // onJoin fires here, TowerSession.players is already full and
    // addPlayer() returns false without pushing an entry or starting the
    // engine — safe to call unconditionally.
    const joined = session.addPlayer(auth.userId, client);
    if (seat === 'player' && auth.mode === 'single') session.enableBot();
    client.send('init', { joined, state: session.getPublicState() });
    if (session.playerCount === 2) {
      ctx.broadcast('game_ready', { state: session.getPublicState() });
    }
  },
  onLeave(session, auth, client) {
    session.pauseForDisconnect(auth.userId, client);
  },
  onDispose(session) {
    session.dispose();
  },
};
