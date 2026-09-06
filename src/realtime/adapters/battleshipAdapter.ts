import type { ShipPlacement } from 'services/activity/battleship/BattleshipEngine';
import { BattleshipSession } from 'services/activity/battleship/BattleshipSession';
import type { PerClientBroadcaster } from 'services/activity/cards/PerClientBroadcaster';
import type { AdapterContext, GameRoomAdapter } from '../GameRoomAdapter';

const FIRE_RATE_LIMIT_WINDOW_MS = 1000;
const FIRE_RATE_LIMIT_MAX = 5;
const PLACE_RATE_LIMIT_WINDOW_MS = 1000;
const PLACE_RATE_LIMIT_MAX = 3;

export const battleshipAdapter: GameRoomAdapter<BattleshipSession> = {
  maxPlayers: 2,
  supportsBot: true,
  supportsQueue: true,

  setup(ctx: AdapterContext) {
    const broadcaster: PerClientBroadcaster = {
      sendToPlayer: (userId, message) =>
        ctx.sendToPlayer(userId, message.type, message.payload),
      broadcastPublic: (message) =>
        ctx.broadcast(message.type, message.payload),
    };

    const session = new BattleshipSession(
      {
        sessionKey: ctx.roomKey,
        instanceId: ctx.instanceId,
        guildId: ctx.guildId,
        mode: ctx.mode,
      },
      broadcaster,
      undefined,
      { onSessionEnded: ctx.onSessionEnded },
    );

    return {
      session,
      messageHandlers: {
        place_ships: {
          rateLimit: {
            windowMs: PLACE_RATE_LIMIT_WINDOW_MS,
            max: PLACE_RATE_LIMIT_MAX,
          },
          handle: (auth, _client, payload: unknown) => {
            const placements = (payload as { placements?: ShipPlacement[] })
              ?.placements;
            if (!Array.isArray(placements)) return;
            session.placeShips(auth.userId, placements);
          },
        },
        fire: {
          rateLimit: {
            windowMs: FIRE_RATE_LIMIT_WINDOW_MS,
            max: FIRE_RATE_LIMIT_MAX,
          },
          handle: (auth, _client, payload: unknown) => {
            const { x, y } = (payload as { x?: number; y?: number }) ?? {};
            if (typeof x !== 'number' || typeof y !== 'number') return;
            session.fire(auth.userId, x, y);
          },
        },
        leave: {
          handle: (auth, client) => session.leave(auth.userId, client),
        },
      },
    };
  },

  onJoin(session, auth, client, seat) {
    if (seat !== 'player') {
      client.send('init', { side: null });
      // Registers the connection for the masked spectator broadcast (Task
      // 14) — without this call the client is acked but never tracked, so
      // it never receives a 'state' message on any future move.
      session.addSpectator(auth.userId, client);
      return;
    }
    const side = session.addPlayer(auth.userId, client);
    client.send('init', { side });
    if (side && auth.mode === 'single') session.enableBot(side);
  },
  onLeave(session, auth, client) {
    session.pauseForDisconnect(auth.userId, client);
  },
  onDispose(session) {
    session.dispose();
  },
  getWinnerUserId(session) {
    return session.getWinnerUserId();
  },
  substitutePlayer(session, outgoingUserId, incomingUserId, incomingClient) {
    return session.substitutePlayer(
      outgoingUserId,
      incomingUserId,
      incomingClient,
    );
  },
};
