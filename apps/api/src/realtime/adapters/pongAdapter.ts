import {
  inputPayloadSchema,
  lobbyConfigPayloadSchema,
  readyPayloadSchema,
  type PongServerMessage,
} from '@marquinhos/contracts/activity/games/pong';
import type { PongArenaEngineConfig } from '@marquinhos/domain/games/pong/PongArenaEngine';
import {
  getPongRuleset,
  isPongRulesetId,
} from '@marquinhos/domain/games/pong/PongRulesetRegistry';
import { PongSession } from 'services/activity/pong/PongSession';
import type { AdapterContext, GameRoomAdapter } from '../GameRoomAdapter';
import { sendMessage } from '../sendMessage';

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

function sendInit(
  session: PongSession,
  userId: string,
  client: Parameters<typeof sendMessage>[0],
) {
  const assignment = session.getAssignment(userId);
  sendMessage<PongServerMessage>(client, {
    type: 'init',
    payload: {
      selfUserId: userId,
      side: assignment?.side ?? null,
      assignment,
      config: session.getPublicConfig(),
      lobby: session.getLobbyState(),
    },
  });
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
        // through.
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
            const parsed = inputPayloadSchema.safeParse(rawPayload);
            if (!parsed.success) return;
            const payload = parsed.data;
            session.handleInput(
              auth.userId,
              payload.direction ?? 0,
              payload.seq,
              payload.side,
              payload.target,
              payload.action === 'release',
            );
          },
        },
        ready: {
          handle: (auth, _client, rawPayload) => {
            const parsed = readyPayloadSchema.safeParse(rawPayload);
            session.setReady(auth.userId, parsed.success && parsed.data.ready);
          },
        },
        sync: {
          handle: (auth, client) => sendInit(session, auth.userId, client),
        },
        lobby_config: {
          handle: (auth, _client, rawPayload) => {
            const parsed = lobbyConfigPayloadSchema.safeParse(rawPayload);
            const fields = parsed.success ? parsed.data : {};
            const config: Partial<PongArenaEngineConfig> = {};
            if (fields.ruleset !== undefined) config.ruleset = fields.ruleset;
            if (fields.targetScore !== undefined)
              config.targetScore = fields.targetScore;
            if (fields.bestOf !== undefined) config.bestOf = fields.bestOf;
            if (fields.ranked !== undefined) config.ranked = fields.ranked;
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
      sendInit(session, auth.userId, client);
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
      sendInit(session, auth.userId, client);
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
