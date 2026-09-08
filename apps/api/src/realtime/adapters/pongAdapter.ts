import type { PongArenaEngineConfig } from 'services/activity/pong/PongArenaEngine';
import {
  getPongRuleset,
  isPongRulesetId,
} from 'services/activity/pong/PongRulesetRegistry';
import { PongSession } from 'services/activity/pong/PongSession';
import type { PongSide } from 'services/activity/pong/PongTypes';
import type { AdapterContext, GameRoomAdapter } from '../GameRoomAdapter';

const INPUT_RATE_LIMIT_WINDOW_MS = 1000;
const INPUT_RATE_LIMIT_MAX = 120;

function pongConfig(ctx: AdapterContext): Partial<PongArenaEngineConfig> {
  const options = ctx.options ?? {};
  return {
    ruleset: isPongRulesetId(ctx.ruleset) ? ctx.ruleset : 'classic-1v1',
    ...(ctx.winningScore !== undefined
      ? { targetScore: ctx.winningScore }
      : {}),
    ...(options.bestOf === 1 || options.bestOf === 3 || options.bestOf === 5
      ? { bestOf: options.bestOf }
      : {}),
    ...(typeof options.ranked === 'boolean' ? { ranked: options.ranked } : {}),
  };
}

export const pongAdapter: GameRoomAdapter<PongSession> = {
  maxPlayers: 4,
  supportsBot: true,
  supportsQueue: false,

  setup(ctx: AdapterContext) {
    const session = new PongSession(
      {
        sessionKey: ctx.roomKey,
        instanceId: ctx.instanceId,
        guildId: ctx.guildId,
        mode: ctx.mode,
      },
      {
        broadcast: (_key, message) =>
          ctx.broadcast(message.type, message.payload),
        // PongSession always calls broadcastBinary(this.roomKey, ...) — the
        // key is legacy/unused (see ActivityBroadcaster.ts), but the client
        // listens for binary snapshots specifically under message type
        // 'state', so that has to be hardcoded here rather than passed
        // through, exactly like PongRoom.ts does today.
        broadcastBinary: (_key, data) =>
          ctx.broadcastBinary('state', new Uint8Array(data)),
      },
      undefined,
      pongConfig(ctx),
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
          handle: (auth, _client, rawPayload) => {
            const payload = rawPayload as {
              direction?: -1 | 0 | 1;
              seq?: number;
              side?: PongSide;
              target?: number;
              action?: 'move' | 'release';
            };
            if (!Number.isInteger(payload?.seq) || payload.seq! < 0) return;
            if (
              payload.direction !== undefined &&
              payload.direction !== -1 &&
              payload.direction !== 0 &&
              payload.direction !== 1
            ) {
              return;
            }
            if (
              payload.target !== undefined &&
              (typeof payload.target !== 'number' ||
                !Number.isFinite(payload.target))
            ) {
              return;
            }
            if (
              payload.side !== undefined &&
              payload.side !== 'left' &&
              payload.side !== 'right' &&
              payload.side !== 'top' &&
              payload.side !== 'bottom'
            ) {
              return;
            }
            session.handleInput(
              auth.userId,
              payload?.direction ?? 0,
              payload?.seq ?? 0,
              payload?.side,
              payload?.target,
              payload?.action === 'release',
            );
          },
        },
        ready: {
          handle: (auth, _client, rawPayload) => {
            const payload = rawPayload as { ready?: boolean };
            session.setReady(auth.userId, payload?.ready === true);
          },
        },
        sync: {
          handle: (auth, client) => {
            const assignment = session.getAssignment(auth.userId);
            client.send('init', {
              selfUserId: auth.userId,
              side: assignment?.side ?? null,
              assignment,
              config: session.getPublicConfig(),
              lobby: session.getLobbyState(),
            });
          },
        },
        lobby_config: {
          handle: (auth, _client, rawPayload) => {
            const payload = rawPayload as Partial<PongArenaEngineConfig>;
            const config: Partial<PongArenaEngineConfig> = {};
            if (isPongRulesetId(payload?.ruleset))
              config.ruleset = payload.ruleset;
            if (
              Number.isInteger(payload?.targetScore) &&
              payload.targetScore! >= 1 &&
              payload.targetScore! <= 99
            ) {
              config.targetScore = payload.targetScore;
            }
            if (
              payload?.bestOf === 1 ||
              payload?.bestOf === 3 ||
              payload?.bestOf === 5
            ) {
              config.bestOf = payload.bestOf;
            }
            if (typeof payload?.ranked === 'boolean')
              config.ranked = payload.ranked;
            session.configure(auth.userId, config);
          },
        },
        restart: {
          handle: (auth) => session.requestRestart(auth.userId),
        },
        leave: {
          handle: (auth, client) => session.leave(auth.userId, client),
        },
      },
    };
  },

  onJoin(session, auth, client, seat, _ctx) {
    if (seat !== 'player') {
      client.send('init', {
        selfUserId: auth.userId,
        side: null,
        assignment: null,
        config: session.getPublicConfig(),
        lobby: session.getLobbyState(),
      });
      return;
    }

    const side = session.addPlayer(
      auth.userId,
      client,
      auth.displayName ?? auth.userId,
      false,
    );
    const assignment = session.getAssignment(auth.userId);
    if (assignment && auth.mode === 'single') {
      const definition = getPongRuleset(session.getPublicConfig().ruleset);
      if (definition.maxPlayers > 1 && definition.supportsBot) {
        session.enableBot(side ?? undefined, auth.difficulty);
      }
      session.start();
    } else if (auth.mode === 'local') {
      session.enableLocalTwoPlayer();
      session.start();
    }

    setTimeout(() => {
      client.send('init', {
        selfUserId: auth.userId,
        side,
        assignment,
        config: session.getPublicConfig(),
        lobby: session.getLobbyState(),
      });
      session.publishLobby();
    }, 0);
  },

  onLeave(session, auth, client) {
    session.pauseForDisconnect(auth.userId, client);
  },

  onDispose(session) {
    session.dispose();
  },
};
