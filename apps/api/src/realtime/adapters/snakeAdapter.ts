import type { SnakeDirection } from 'services/activity/snake-game/SnakeEngine';
import { SnakeSession } from 'services/activity/snake-game/SnakeSession';
import type { AdapterContext, GameRoomAdapter } from '../GameRoomAdapter';

const INPUT_RATE_LIMIT_WINDOW_MS = 1000;
const INPUT_RATE_LIMIT_MAX = 60;

const VALID_DIRECTIONS: ReadonlySet<SnakeDirection> = new Set([
  'up',
  'down',
  'left',
  'right',
]);

// A `direction` isn't just cosmetically wrong if malformed: SnakeSession
// forwards whatever string it's given straight into
// SnakeEngine.setDirection() -> movePoint()'s `directionMap[direction]`
// lookup, which happens inside the session's own `setInterval` tick loop —
// decoupled from this handler's call stack, so no per-message try/catch
// here would catch it. An invalid key makes `directionMap[direction]`
// `undefined`, and the next line's `delta.dx` throws a TypeError with
// nothing upstream to catch it, crashing the whole process (every
// concurrent room, not just this one). So malformed input must never reach
// `session.handleInput` at all — reject it here instead.
function isValidDirection(value: unknown): value is SnakeDirection {
  return (
    typeof value === 'string' && VALID_DIRECTIONS.has(value as SnakeDirection)
  );
}

export const snakeAdapter: GameRoomAdapter<SnakeSession> = {
  maxPlayers: 2,
  supportsBot: true,
  // Deliberately not queue-eligible for v1 — same "structurally 2-player +
  // bot but out of the approved v1 queue list" note as Task 13's Dominoes.
  supportsQueue: false,

  setup(ctx: AdapterContext) {
    const session = new SnakeSession(
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
      { width: 20, height: 20, initialSnakeLength: 3 },
      { onSessionEnded: ctx.onSessionEnded },
    );

    return {
      session,
      messageHandlers: {
        input: {
          rateLimit: {
            windowMs: INPUT_RATE_LIMIT_WINDOW_MS,
            max: INPUT_RATE_LIMIT_MAX,
          },
          handle: (auth, client, payload: unknown) => {
            const direction = (payload as { direction?: unknown })?.direction;
            if (!isValidDirection(direction)) {
              client.send('input_error', { message: 'Invalid direction' });
              return;
            }
            session.handleInput(auth.userId, direction);
          },
        },
        leave: { handle: (auth, client) => session.leave(auth.userId, client) },
      },
    };
  },

  onJoin(session, auth, client, seat) {
    // SnakeSession.addPlayer() carries its own capacity check
    // (`this.players.length >= 2`), independent of MatchRoom's own seat
    // bookkeeping. MatchRoom.assignSeat() only ever hands out 'spectator'
    // once 2 members already hold 'player', so by the time a non-player
    // seat's onJoin runs here, SnakeSession.players is already full and
    // addPlayer() returns null without pushing an entry or calling
    // engine.addSnake() — this is the same safe-to-call-unconditionally
    // shape as CardTableSession/DominoesSession, not MinesweeperSession
    // (which has no capacity check and would let a spectator's addPlayer
    // call actually enroll them as a real participant). handleInput() also
    // no-ops for any userId not in `players`, so a spectator's `input`
    // message is inert. See tests/matchRoom.test.ts's Snake spectator test
    // for the live proof.
    const playerId = session.addPlayer(auth.userId, client);
    if (seat === 'player' && auth.mode === 'single') session.enableBot();
    client.send('init', { playerId, config: session.getPublicConfig() });
  },
  onLeave(session, auth, client) {
    session.pauseForDisconnect(auth.userId, client);
  },
  onDispose(session) {
    session.dispose();
  },
};
