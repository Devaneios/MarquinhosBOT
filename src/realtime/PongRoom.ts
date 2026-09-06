import { Room, type Client } from 'colyseus';
import type { PongArenaEngineConfig } from 'services/activity/pong/PongArenaEngine';
import {
  getPongRuleset,
  isPongRulesetId,
} from 'services/activity/pong/PongRulesetRegistry';
import type { ActivityBroadcaster } from 'services/activity/pong/PongSession';
import { PongSession } from 'services/activity/pong/PongSession';
import type { PongSide } from 'services/activity/pong/PongTypes';
import { roomKey } from 'services/activity/roomKey';
import { RateLimiter } from 'services/activity/shared/RateLimiter';
import {
  verifyWsSessionToken,
  type WsSessionPayload,
} from 'services/activity/wsSessionToken';

const INPUT_RATE_LIMIT_WINDOW_MS = 1000;
const INPUT_RATE_LIMIT_MAX = 120;

function pongConfig(session: WsSessionPayload): Partial<PongArenaEngineConfig> {
  const options = session.options ?? {};
  return {
    ruleset: isPongRulesetId(session.ruleset) ? session.ruleset : 'classic-1v1',
    ...(session.winningScore !== undefined
      ? { targetScore: session.winningScore }
      : {}),
    ...(options.bestOf === 1 || options.bestOf === 3 || options.bestOf === 5
      ? { bestOf: options.bestOf }
      : {}),
    ...(typeof options.ranked === 'boolean' ? { ranked: options.ranked } : {}),
  };
}

export class PongRoom extends Room {
  private session!: PongSession;
  private inputRateLimiter = new RateLimiter({
    windowMs: INPUT_RATE_LIMIT_WINDOW_MS,
    max: INPUT_RATE_LIMIT_MAX,
  });

  override async onAuth(
    _client: Client,
    options: { token?: string; roomKey?: string },
  ): Promise<WsSessionPayload> {
    const session = options.token ? verifyWsSessionToken(options.token) : null;
    if (!session) throw new Error('Invalid or expired session token');
    if (roomKey(session) !== options.roomKey) {
      throw new Error('Room key does not match session identity');
    }
    return session;
  }

  override onCreate(options: { roomKey: string; token?: string }) {
    void this.setMetadata({ roomKey: options.roomKey });

    const initialSession = options.token
      ? verifyWsSessionToken(options.token)
      : null;

    const broadcaster: ActivityBroadcaster = {
      broadcast: (_key, message) => {
        this.broadcast(message.type, message.payload);
      },
      broadcastBinary: (_key, data) => {
        this.broadcastBytes('state', new Uint8Array(data), {});
      },
    };

    this.session = new PongSession(
      {
        sessionKey: options.roomKey,
        instanceId: initialSession?.instanceId ?? '',
        guildId: initialSession?.guildId ?? '',
        mode: initialSession?.mode ?? 'multi',
      },
      broadcaster,
      undefined,
      initialSession ? pongConfig(initialSession) : undefined,
      { onSessionEnded: () => this.disconnect() },
    );

    this.onMessage(
      'input',
      (
        client,
        payload: {
          direction?: -1 | 0 | 1;
          seq?: number;
          side?: PongSide;
          target?: number;
          action?: 'move' | 'release';
        },
      ) => {
        if (this.inputRateLimiter.isOverLimit(client)) return;
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
        const auth = client.auth as WsSessionPayload;
        this.session.handleInput(
          auth.userId,
          payload?.direction ?? 0,
          payload?.seq ?? 0,
          payload?.side,
          payload?.target,
          payload?.action === 'release',
        );
      },
    );

    this.onMessage('ready', (client, payload: { ready?: boolean }) => {
      const auth = client.auth as WsSessionPayload;
      this.session.setReady(auth.userId, payload?.ready === true);
    });

    this.onMessage('sync', (client) => {
      const auth = client.auth as WsSessionPayload;
      const assignment = this.session.getAssignment(auth.userId);
      client.send('init', {
        selfUserId: auth.userId,
        side: assignment?.side ?? null,
        assignment,
        config: this.session.getPublicConfig(),
        lobby: this.session.getLobbyState(),
      });
    });

    this.onMessage(
      'lobby_config',
      (client, payload: Partial<PongArenaEngineConfig>) => {
        const auth = client.auth as WsSessionPayload;
        const config: Partial<PongArenaEngineConfig> = {};
        if (isPongRulesetId(payload?.ruleset)) config.ruleset = payload.ruleset;
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
        this.session.configure(auth.userId, config);
      },
    );

    this.onMessage('restart', (client) => {
      const auth = client.auth as WsSessionPayload;
      this.session.requestRestart(auth.userId);
    });

    this.onMessage('leave', (client) => {
      const auth = client.auth as WsSessionPayload;
      this.session.leave(auth.userId, client);
    });
  }

  override onJoin(client: Client, _options: unknown, auth: WsSessionPayload) {
    const side = this.session.addPlayer(
      auth.userId,
      client,
      auth.displayName ?? auth.userId,
      false,
    );
    const assignment = this.session.getAssignment(auth.userId);
    if (assignment && auth.mode === 'single') {
      const definition = getPongRuleset(this.session.getPublicConfig().ruleset);
      if (definition.maxPlayers > 1 && definition.supportsBot) {
        this.session.enableBot(side ?? undefined, auth.difficulty);
      }
      this.session.start();
    } else if (auth.mode === 'local') {
      this.session.enableLocalTwoPlayer();
      this.session.start();
    }
    setTimeout(() => {
      client.send('init', {
        selfUserId: auth.userId,
        side,
        assignment,
        config: this.session.getPublicConfig(),
        lobby: this.session.getLobbyState(),
      });
      this.session.publishLobby();
    }, 0);
  }

  override onLeave(client: Client) {
    this.inputRateLimiter.clear(client);
    const auth = client.auth as WsSessionPayload;
    this.session.pauseForDisconnect(auth.userId, client);
  }

  override onDispose() {
    this.session.dispose();
  }
}
