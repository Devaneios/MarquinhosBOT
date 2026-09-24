import {
  pickPayloadSchema,
  type RpsServerMessage,
} from '@marquinhos/contracts/activity/games/rockPaperScissors';
import { RpsSession } from 'services/activity/rps/RpsSession';
import type { AdapterContext, GameRoomAdapter } from '../GameRoomAdapter';
import { broadcastMessage, sendMessage } from '../sendMessage';

const PICK_RATE_LIMIT_WINDOW_MS = 1000;
const PICK_RATE_LIMIT_MAX = 10;

export const rpsAdapter: GameRoomAdapter<RpsSession> = {
  maxPlayers: 2,
  supportsBot: true,
  supportsQueue: true,

  setup(ctx: AdapterContext) {
    const session = new RpsSession(
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
      undefined,
      { onSessionEnded: ctx.onSessionEnded },
    );

    return {
      session,
      messageHandlers: {
        pick: {
          rateLimit: {
            windowMs: PICK_RATE_LIMIT_WINDOW_MS,
            max: PICK_RATE_LIMIT_MAX,
          },
          handle: (auth, client, payload: unknown) => {
            const parsed = pickPayloadSchema.safeParse(payload);
            const success =
              parsed.success &&
              session.submitPick(auth.userId, parsed.data.pick);
            if (!success)
              sendMessage<RpsServerMessage>(client, {
                type: 'error',
                payload: { message: 'Invalid move' },
              });
          },
        },
        leave: {
          handle: (auth, client) => session.leave(auth.userId, client),
        },
      },
    };
  },

  onJoin(session, auth, client, seat, ctx) {
    if (seat !== 'player') {
      sendMessage<RpsServerMessage>(client, {
        type: 'init',
        payload: { playerId: null, config: session.getPublicConfig() },
      });
      return;
    }
    const playerId = session.addPlayer(auth.userId, client);
    if (!playerId) {
      sendMessage<RpsServerMessage>(client, {
        type: 'error',
        payload: { message: 'Game is full' },
      });
      client.leave();
      return;
    }
    sendMessage<RpsServerMessage>(client, {
      type: 'init',
      payload: { playerId, config: session.getPublicConfig() },
    });
    if (auth.mode === 'single') session.enableBot(playerId);
    if (session.playerCount === 2 || auth.mode === 'single') {
      broadcastMessage<RpsServerMessage>(ctx, {
        type: 'game_start',
        payload: {},
      });
      broadcastMessage<RpsServerMessage>(ctx, {
        type: 'round_state',
        payload: session.getRoundState(),
      });
    }
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
    const playerId = session.substitutePlayer(
      outgoingUserId,
      incomingUserId,
      incomingClient,
    );
    if (!playerId) return false;
    sendMessage<RpsServerMessage>(incomingClient, {
      type: 'init',
      payload: { playerId, config: session.getPublicConfig() },
    });
    return true;
  },
};
