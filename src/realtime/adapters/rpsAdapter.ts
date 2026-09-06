import { RpsSession } from 'services/activity/rps/RpsSession';
import type { AdapterContext, GameRoomAdapter } from '../GameRoomAdapter';

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
            const pick = (payload as { pick?: string })?.pick;
            const success = session.submitPick(auth.userId, pick);
            if (!success) client.send('error', { message: 'Invalid move' });
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
      client.send('init', {
        playerId: null,
        config: session.getPublicConfig(),
      });
      return;
    }
    const playerId = session.addPlayer(auth.userId, client);
    if (!playerId) {
      client.send('error', { message: 'Game is full' });
      client.leave();
      return;
    }
    client.send('init', { playerId, config: session.getPublicConfig() });
    if (auth.mode === 'single') session.enableBot(playerId);
    if (session.playerCount === 2 || auth.mode === 'single') {
      ctx.broadcast('game_start', {});
      ctx.broadcast('round_state', session.getRoundState());
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
    return session.substitutePlayer(
      outgoingUserId,
      incomingUserId,
      incomingClient,
    );
  },
};
