import type {
  ChainEnd,
  Tile,
} from 'services/activity/dominoesBlock/DominoesEngine';
import { DominoesSession } from 'services/activity/dominoesBlock/DominoesSession';
import type { AdapterContext, GameRoomAdapter } from '../GameRoomAdapter';

const MOVE_RATE_LIMIT_WINDOW_MS = 1000;
const MOVE_RATE_LIMIT_MAX = 10;

function isTile(value: unknown): value is Tile {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Tile).a === 'number' &&
    typeof (value as Tile).b === 'number' &&
    Number.isInteger((value as Tile).a) &&
    Number.isInteger((value as Tile).b) &&
    (value as Tile).a >= 0 &&
    (value as Tile).a <= 6 &&
    (value as Tile).b >= 0 &&
    (value as Tile).b <= 6
  );
}

function isChainEnd(value: unknown): value is ChainEnd {
  return value === 'left' || value === 'right';
}

export const dominoesAdapter: GameRoomAdapter<DominoesSession> = {
  maxPlayers: 2,
  supportsBot: true,
  // Deliberately not queue-eligible for v1 — Dominoes is structurally
  // identical to the 6 queue-eligible games (2-player, bot-capable) but is
  // out of scope per the spec's approved queue list. Adding queue support
  // later needs the same getWinnerUserId/substitutePlayer treatment as
  // Task 5/6; not part of this task.
  supportsQueue: false,

  setup(ctx: AdapterContext) {
    const session = new DominoesSession(
      {
        sessionKey: ctx.roomKey,
        instanceId: ctx.instanceId,
        guildId: ctx.guildId,
      },
      {
        sendToPlayer: (userId, message) =>
          ctx.sendToPlayer(userId, message.type, message.payload),
        broadcastPublic: (message) =>
          ctx.broadcast(message.type, message.payload),
      },
      undefined,
      { onSessionEnded: ctx.onSessionEnded },
    );

    return {
      session,
      messageHandlers: {
        play: {
          rateLimit: {
            windowMs: MOVE_RATE_LIMIT_WINDOW_MS,
            max: MOVE_RATE_LIMIT_MAX,
          },
          handle: (auth, client, payload: unknown) => {
            const { tile, end } =
              (payload as { tile?: Tile; end?: ChainEnd }) ?? {};
            if (!isTile(tile)) {
              client.send('move_rejected', { reason: 'Malformed tile' });
              return;
            }
            if (end !== undefined && !isChainEnd(end)) {
              client.send('move_rejected', { reason: 'Malformed end' });
              return;
            }
            session.playTile(auth.userId, tile, end);
          },
        },
        pass: {
          rateLimit: {
            windowMs: MOVE_RATE_LIMIT_WINDOW_MS,
            max: MOVE_RATE_LIMIT_MAX,
          },
          handle: (auth) => session.passTurn(auth.userId),
        },
        restart: { handle: (auth) => session.requestRestart(auth.userId) },
        leave: { handle: (auth, client) => session.leave(auth.userId, client) },
      },
    };
  },

  onJoin(session, auth, client, seat) {
    // DominoesSession has no separate `init` ack even on the player path
    // (unlike Boggle/Battleship/CardTable) — a joiner only ever learns
    // anything through the 'state' message that addPlayer()/start()
    // trigger. So a spectator's "equivalent minimal message" is that same
    // 'state' snapshot, not a fabricated ack the client was never coded to
    // expect. addPlayer() internally routes a seatless caller to
    // addSpectator() (the same pattern CardTableSession uses), which is
    // what actually gets a spectator that snapshot now and on every future
    // broadcastState() — calling it unconditionally, instead of returning
    // bare for a non-player seat, is what makes that seat receive ongoing
    // state rather than nothing at all.
    session.addPlayer(auth.userId, client);
    if (seat === 'player' && auth.mode === 'single') session.enableBot();
  },
  onLeave(session, auth, client) {
    session.pauseForDisconnect(auth.userId, client);
  },
  onDispose(session) {
    session.dispose();
  },
};
