import { CardTableSession } from 'services/activity/cards/CardTableSession';
import type { PerClientBroadcaster } from 'services/activity/cards/PerClientBroadcaster';
import { cardGameRegistry } from 'services/activity/cards/registry';
import { GamificationService } from 'services/gamification/GamificationService';
import type { AdapterContext, GameRoomAdapter } from '../GameRoomAdapter';

const MOVE_RATE_LIMIT_WINDOW_MS = 1000;
const MOVE_RATE_LIMIT_MAX = 20;

// maxPlayers below is a placeholder only: registered rulesets have differing
// seat counts (truco=4, truco-1v1=2), so the real capacity is computed per
// room inside setup() from the resolved GameDefinition and returned
// alongside session/messageHandlers — see GameRoomAdapter's `maxPlayers?`
// setup() return field, which MatchRoom prefers over this static value.
export const cardTableAdapter: GameRoomAdapter<CardTableSession<unknown>> = {
  maxPlayers: 4,
  supportsBot: false,
  supportsQueue: false,

  setup(ctx: AdapterContext) {
    if (!ctx.ruleset) throw new Error('A cards room requires a ruleset');
    const definition = cardGameRegistry.get(ctx.ruleset);
    if (!definition) throw new Error(`Unknown card ruleset: ${ctx.ruleset}`);

    const broadcaster: PerClientBroadcaster = {
      sendToPlayer: (userId, message) =>
        ctx.sendToPlayer(userId, message.type, message.payload),
      broadcastPublic: (message) =>
        ctx.broadcast(message.type, message.payload),
    };

    const session = new CardTableSession(
      {
        sessionKey: ctx.roomKey,
        instanceId: ctx.instanceId,
        guildId: ctx.guildId,
      },
      broadcaster,
      definition,
      new GamificationService(),
      { onSessionEnded: ctx.onSessionEnded, setupOptions: ctx.options },
    );

    return {
      session,
      maxPlayers: definition.maxPlayers,
      messageHandlers: {
        move: {
          rateLimit: {
            windowMs: MOVE_RATE_LIMIT_WINDOW_MS,
            max: MOVE_RATE_LIMIT_MAX,
          },
          handle: (auth, _client, payload: unknown) => {
            const { move, args } =
              (payload as { move?: string; args?: unknown }) ?? {};
            if (!move) return;
            session.handleMove(auth.userId, move, args);
          },
        },
        restart: { handle: (auth) => session.requestRestart(auth.userId) },
        leave: { handle: (auth, client) => session.leave(auth.userId, client) },
      },
    };
  },

  onJoin(session, auth, client, seat) {
    if (seat !== 'player') {
      client.send('init', { seatIndex: null });
      // Still routes through addPlayer: CardTableSession itself resolves
      // seatIndexFor() -> null for a non-seated joiner and internally hands
      // them to addSpectator(), which is what actually gets them the
      // spectator-masked snapshot now and on every future state broadcast.
      // Without this call a spectator is acked but never registered, so the
      // table stays permanently blank for them.
      session.addPlayer(auth.userId, client);
      return;
    }
    const seatIndex = session.seatIndexFor(auth.userId);
    client.send('init', { seatIndex });
    session.addPlayer(auth.userId, client);
  },
  onLeave(session, auth, client) {
    session.pauseForDisconnect(auth.userId, client);
  },
  onDispose(session) {
    session.dispose();
  },
};
