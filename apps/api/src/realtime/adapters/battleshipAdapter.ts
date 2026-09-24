import {
  firePayloadSchema,
  placeShipsPayloadSchema,
  type BattleshipServerMessage,
} from '@marquinhos/contracts/activity/games/battleship';
import { BattleshipSession } from 'services/activity/battleship/BattleshipSession';
import type { PerClientBroadcaster } from 'services/activity/cards/PerClientBroadcaster';
import type { AdapterContext, GameRoomAdapter } from '../GameRoomAdapter';
import { sendMessage } from '../sendMessage';

const FIRE_RATE_LIMIT_WINDOW_MS = 1000;
const FIRE_RATE_LIMIT_MAX = 5;
const PLACE_RATE_LIMIT_WINDOW_MS = 1000;
const PLACE_RATE_LIMIT_MAX = 3;

export const battleshipAdapter: GameRoomAdapter<BattleshipSession> = {
  maxPlayers: 2,
  supportsBot: true,
  supportsQueue: true,

  setup(ctx: AdapterContext) {
    const broadcaster: PerClientBroadcaster<BattleshipServerMessage> = {
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
          handle: (auth, client, payload: unknown) => {
            const parsed = placeShipsPayloadSchema.safeParse(payload);
            if (!parsed.success) {
              sendMessage<BattleshipServerMessage>(client, {
                type: 'placement_error',
                payload: { message: 'Invalid ship placements' },
              });
              return;
            }
            session.placeShips(auth.userId, parsed.data.placements);
          },
        },
        fire: {
          rateLimit: {
            windowMs: FIRE_RATE_LIMIT_WINDOW_MS,
            max: FIRE_RATE_LIMIT_MAX,
          },
          handle: (auth, _client, payload: unknown) => {
            const parsed = firePayloadSchema.safeParse(payload);
            if (!parsed.success) return;
            session.fire(auth.userId, parsed.data.x, parsed.data.y);
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
      sendMessage<BattleshipServerMessage>(client, {
        type: 'init',
        payload: { side: null },
      });
      // Registers the connection for the masked spectator broadcast (Task
      // 14) — without this call the client is acked but never tracked, so
      // it never receives a 'state' message on any future move.
      session.addSpectator(auth.userId, client);
      return;
    }
    const side = session.addPlayer(auth.userId, client);
    sendMessage<BattleshipServerMessage>(client, {
      type: 'init',
      payload: { side },
    });
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
    const side = session.substitutePlayer(
      outgoingUserId,
      incomingUserId,
      incomingClient,
    );
    if (!side) return false;
    sendMessage<BattleshipServerMessage>(incomingClient, {
      type: 'init',
      payload: { side },
    });
    return true;
  },
};
