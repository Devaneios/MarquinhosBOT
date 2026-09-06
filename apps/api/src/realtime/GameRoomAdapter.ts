import type { Client } from 'colyseus';
import type { ActivityMode } from 'services/activity/gameId';
import type { BotDifficulty } from 'services/activity/pong/PongBotAI';
import type { WsSessionPayload } from 'services/activity/wsSessionToken';

export type SeatRole = 'player' | 'spectator' | 'queued';

// Everything an adapter needs to talk to the outside world, backed by the
// live MatchRoom instance. One shape covers all three broadcaster styles
// used across the 19 existing *Room.ts files (plain broadcast, Pong's binary
// variant, Battleship/CardTable/Dominoes' per-client sends) — each adapter
// builds whatever shape its Session constructor expects from these
// primitives, exactly as today's Room.ts files build an inline broadcaster
// object from `this.broadcast`/`this.clients`.
export interface AdapterContext {
  roomKey: string;
  instanceId: string;
  guildId: string;
  mode: ActivityMode;
  difficulty?: BotDifficulty;
  winningScore?: number;
  ruleset?: string;
  options?: Record<string, unknown>;
  broadcast: (type: string, payload?: unknown) => void;
  broadcastBinary: (type: string, data: Uint8Array) => void;
  sendToPlayer: (userId: string, type: string, payload?: unknown) => void;
  onSessionEnded: () => void;
}

export interface MessageHandler {
  rateLimit?: { windowMs: number; max: number };
  handle: (auth: WsSessionPayload, client: Client, payload: unknown) => void;
}

export interface GameRoomAdapter<TSession> {
  maxPlayers: number;
  supportsBot: boolean;
  supportsQueue: boolean;

  setup(ctx: AdapterContext): {
    session: TSession;
    messageHandlers: Record<string, MessageHandler>;
    // Per-instance override of the static `maxPlayers` above, for adapters
    // whose seat count depends on data only known once setup() has resolved
    // it (e.g. CardTable's per-ruleset seat count). undefined preserves the
    // static field's value.
    maxPlayers?: number;
  };
  onJoin(
    session: TSession,
    auth: WsSessionPayload,
    client: Client,
    seat: SeatRole,
    ctx: AdapterContext,
  ): void;
  onLeave(session: TSession, auth: WsSessionPayload, client: Client): void;
  onDispose(session: TSession): void;

  // Required only for the 6 queue-eligible games (supportsQueue: true).
  getWinnerUserId?(session: TSession): string | null;
  substitutePlayer?(
    session: TSession,
    outgoingUserId: string,
    incomingUserId: string,
    incomingClient: Client,
  ): boolean;
}
