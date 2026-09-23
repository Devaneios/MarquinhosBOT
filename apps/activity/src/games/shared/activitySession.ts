import { z } from 'zod';
import type { DiscordIdentity } from '../../discordAuth.ts';
import { apiUrl } from '../../lib/apiBase';
import { postJson } from '../../lib/http';
import { gameIdSchema, type GameId } from '../gameId';

export interface WsSessionParams {
  game: GameId;
  mode: 'single' | 'multi' | 'local';
  identity: DiscordIdentity;
  extra?: Record<string, unknown>;
}

const wsSessionSchema = z.object({
  token: z.string(),
  roomKey: z.string(),
});

export type WsSession = z.infer<typeof wsSessionSchema>;

const createdRoomSchema = z.object({
  roomId: z.string(),
  token: z.string(),
  roomKey: z.string(),
});

export type CreatedRoom = z.infer<typeof createdRoomSchema>;

const roomListingSchema = z.object({
  instanceId: z.string(),
  roomId: z.string(),
  game: gameIdSchema,
  hostUserId: z.string(),
  playerCount: z.number(),
  spectatorCount: z.number(),
  queueDepth: z.number(),
  queueEnabled: z.boolean(),
  mode: z.enum(['single', 'multi']),
});

export type RoomListing = z.infer<typeof roomListingSchema>;

const roomListingsSchema = z.array(z.unknown()).transform((rooms) =>
  rooms.flatMap((room) => {
    const listing = roomListingSchema.safeParse(room);
    return listing.success ? [listing.data] : [];
  }),
);

const deepLinkIntentSchema = z.object({
  game: gameIdSchema.nullable().catch(null),
});

// Shared by every game's session hook: mints a game-scoped WS token (and its
// matching Colyseus roomKey) from the player's Discord identity. Pong layers
// a menu-driven state machine on top of this (usePongSession); a game with
// no mode selection can call it directly.
export function fetchWsSessionToken({
  game,
  mode,
  identity,
  extra,
}: WsSessionParams): Promise<WsSession> {
  return postJson(
    apiUrl('/activities/ws-session'),
    {
      accessToken: identity.accessToken,
      instanceId: identity.instanceId,
      guildId: identity.guildId,
      mode,
      game,
      ...extra,
    },
    wsSessionSchema,
  );
}

// Mints a new multiplayer room (a fresh roomId) and its creating host's
// signed ws-session token together — distinct from fetchWsSessionToken,
// which is what subsequent joiners of an already-created room call instead
// (passing that room's roomId through `extra`).
export function createRoom({
  game,
  identity,
  queueEnabled,
}: {
  game: GameId;
  identity: DiscordIdentity;
  queueEnabled: boolean;
}): Promise<CreatedRoom> {
  return postJson(
    apiUrl('/activities/rooms'),
    {
      accessToken: identity.accessToken,
      instanceId: identity.instanceId,
      guildId: identity.guildId,
      game,
      queueEnabled,
    },
    createdRoomSchema,
  );
}

// Claims (and consumes) a pending deep-link intent recorded server-side by
// the bot before it launched this Activity — e.g. the "Jogar na atividade"
// button on a Wordle win. Returns `game: null` when there is none, which is
// the common case (most launches aren't deep-linked).
export function fetchDeepLinkIntent(
  identity: DiscordIdentity,
): Promise<{ game: GameId | null }> {
  return postJson(
    apiUrl('/activities/deep-link/claim'),
    {
      accessToken: identity.accessToken,
      guildId: identity.guildId,
    },
    deepLinkIntentSchema,
  );
}

// Lists open multiplayer rooms for this Discord Activity instance, so
// RoomLobbyScreen can show "join an existing room" alongside "create a new
// one". Served over REST rather than the classic Colyseus
// `client.getAvailableRooms()` call — the installed @colyseus/sdk's
// matchmaking API only exposes joinOrCreate/create/join/joinById/reconnect,
// so the server exposes matchMaker.query() results at this endpoint instead.
export function getAvailableRooms(
  identity: DiscordIdentity,
): Promise<RoomListing[]> {
  return postJson(
    apiUrl('/activities/rooms/list'),
    {
      accessToken: identity.accessToken,
      instanceId: identity.instanceId,
      guildId: identity.guildId,
    },
    roomListingsSchema,
  );
}
