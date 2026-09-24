import {
  gameIdSchema,
  type ActivityMode,
  type GameId,
} from '@marquinhos/contracts/activity/gameId';
import { ACTION_REJECTED } from '@marquinhos/contracts/activity/protocol';
import {
  ROOM_STATE,
  switchGamePayloadSchema,
  toggleQueuePayloadSchema,
  type RoomServerMessage,
  type RoomState,
} from '@marquinhos/contracts/activity/room';
import { Room } from 'colyseus';
import { requireAuth, type AuthedClient } from 'realtime/authedClient';
import { roomKey } from 'services/activity/roomKey';
import type { MatchRoomMetadata } from 'services/activity/roomListing';
import { RateLimiter } from 'services/activity/shared/RateLimiter';
import {
  verifyWsSessionToken,
  type WsSessionPayload,
} from 'services/activity/wsSessionToken';
import { logger } from 'utils/logger';
import { ADAPTER_REGISTRY } from './adapters/registry';
import type {
  AdapterContext,
  GameRoomAdapter,
  SeatRole,
} from './GameRoomAdapter';
import { broadcastMessage, sendMessage } from './sendMessage';

interface Member {
  userId: string;
  role: SeatRole;
  // Counts concurrent connections (e.g. two tabs) under one userId so a
  // reconnect/second-tab join doesn't inflate `assignSeat()`'s player count
  // or trigger a spurious host handoff when only one of several connections
  // for the same user drops.
  connections: number;
}

// 'cards' and 'pong' can't be switched into from a bare `{ game }` message —
// both require config chosen at creation (cards' ruleset; pong's
// ruleset/winningScore/bestOf/ranked) that switch_game has no way to supply
// (see this task's "known, accepted limitation").
const SWITCHABLE_GAMES: ReadonlySet<GameId> = new Set(
  gameIdSchema.options.filter(
    (g) => ADAPTER_REGISTRY[g] !== undefined && g !== 'cards' && g !== 'pong',
  ),
);

export class MatchRoom extends Room<{
  client: AuthedClient;
  metadata: MatchRoomMetadata;
}> {
  private adapter!: GameRoomAdapter<unknown>;
  private session!: unknown;
  // Per-instance override of `adapter.maxPlayers`, set from setup()'s return
  // value when an adapter's seat count depends on data only known once
  // setup() resolves it (e.g. CardTable's per-ruleset seat count). undefined
  // falls back to the static `adapter.maxPlayers` at every read site.
  private setupMaxPlayers: number | undefined;
  // The per-room AdapterContext, re-captured here (not on the adapter
  // object) because ADAPTER_REGISTRY holds one shared adapter instance
  // across every concurrent room of that game — a module-level capture
  // inside the adapter itself would get clobbered by the next room's
  // setup() call. Passed to onJoin so adapters that need ctx.broadcast
  // outside setup() (e.g. Tic-Tac-Toe's game_ready) always see their own
  // room's context, not whichever room's setup() ran most recently.
  private ctx!: AdapterContext;
  private members: Member[] = [];
  private hostUserId: string | null = null;
  private mode: ActivityMode = 'multi';
  private queueEnabled = false;
  // Guards `maybeRotateAfterMatchEnd()` against cascading: the engine's own
  // winner doesn't clear until both remaining players vote to restart, so
  // without this a rotation, once performed, would re-trigger on the very
  // next call (any subsequent message or broadcast) and see the same
  // still-set winner — computing the just-promoted challenger as "the loser"
  // and rotating them straight back out. Reset to false the moment
  // `getWinnerUserId` reports no winner (i.e. the match has been reset),
  // re-arming the guard for that match's eventual conclusion. Deliberately
  // not "skip if same winner as last time" — that would incorrectly skip a
  // legitimate second win in a row by the same player.
  private rotatedForCurrentMatch = false;
  private rateLimiters = new Map<string, RateLimiter>();
  // Unbind functions returned by `onMessage`, so `loadSession()` can tear
  // down the previous adapter's handlers before registering new ones —
  // `onMessage` appends a listener rather than replacing one for the same
  // type, so without this a second `loadSession()` call (`switch_game`)
  // would leave stale handlers firing against a disposed session.
  private messageUnsubscribers: Array<() => void> = [];
  // Stored on the instance (not read back from `this.metadata`) so it's
  // available synchronously the moment onCreate runs, and again later from
  // `loadSession()`/`syncMetadata()` when `switch_game` calls them a second
  // time without a fresh `options` object.
  private publishedRoomState = '';
  private roomKeyValue = '';
  private roomIdValue = '';
  private game!: GameId;
  // Everything loadSession() needs to rebuild an AdapterContext, captured
  // once at onCreate (from the signed token, when present) so switch_game
  // can call loadSession() a second time without a fresh options object —
  // the room's original creation options aren't re-derivable once the room
  // exists (Pong's difficulty/winningScore reset to defaults on switch).
  private identity: {
    instanceId: string;
    guildId: string;
    difficulty?: WsSessionPayload['difficulty'];
    winningScore?: WsSessionPayload['winningScore'];
    ruleset?: WsSessionPayload['ruleset'];
    options?: WsSessionPayload['options'];
  } = { instanceId: '', guildId: '' };

  override async onAuth(
    _client: AuthedClient,
    options: { token?: string; roomKey?: string },
  ): Promise<WsSessionPayload> {
    const session = options.token ? verifyWsSessionToken(options.token) : null;
    if (!session) throw new Error('Invalid or expired session token');
    if (roomKey(session) !== options.roomKey) {
      throw new Error('Room key does not match session identity');
    }
    return session;
  }

  override onCreate(options: {
    roomKey: string;
    token?: string;
    game?: GameId;
    roomId?: string;
    queueEnabled?: boolean;
  }) {
    this.roomKeyValue = options.roomKey;

    const initialSession = options.token
      ? verifyWsSessionToken(options.token)
      : null;

    // The real client join (`client.joinOrCreate('match', { token, roomKey })`)
    // never needs to pass `game`/`roomId` — both are already encoded in the
    // signed token. `options.game`/`options.roomId` exist purely so tests can
    // create a room without first minting a token. When a token IS present,
    // it must agree with any raw `options.game` also supplied, or a client
    // could load one game's adapter against another game's roomKey/token.
    if (
      initialSession &&
      options.game &&
      initialSession.game !== options.game
    ) {
      throw new Error('game mismatch between token and join options');
    }
    // Signed token wins when present (the token is trusted, the raw option
    // is not); raw `options.game` is only a fallback for tests that create a
    // room without minting a token.
    const game = initialSession?.game ?? options.game;
    if (!game) throw new Error('Cannot determine which game this room is for');

    this.mode = initialSession?.mode ?? 'multi';
    this.queueEnabled =
      this.mode === 'multi'
        ? Boolean(initialSession?.queueEnabled ?? options.queueEnabled)
        : false;
    this.roomIdValue = options.roomId ?? initialSession?.roomId ?? '';
    this.game = game;
    this.identity = {
      instanceId: initialSession?.instanceId ?? '',
      guildId: initialSession?.guildId ?? '',
      difficulty: initialSession?.difficulty,
      winningScore: initialSession?.winningScore,
      ruleset: initialSession?.ruleset,
      options: initialSession?.options,
    };

    const adapter = ADAPTER_REGISTRY[game];
    if (!adapter) throw new Error(`No adapter registered for game "${game}"`);
    this.adapter = adapter;

    this.loadSession();
    this.registerRoomLevelMessages();
    this.syncMetadata();
  }

  // Populates the fields `client.getAvailableRooms('match')` reads
  // client-side for the room list. `hostName` is deliberately not included —
  // WsSessionPayload only carries a userId, never a display name, so
  // resolving "host's display name" is a client-side concern (matching
  // hostUserId against Discord SDK participant data), not something this
  // server can populate.
  private syncMetadata() {
    this.setMetadata({
      roomKey: this.roomKeyValue,
      instanceId: this.identity.instanceId,
      roomId: this.roomIdValue,
      game: this.game,
      hostUserId: this.hostUserId,
      playerCount: this.members.filter((m) => m.role === 'player').length,
      spectatorCount: this.members.filter((m) => m.role === 'spectator').length,
      queueDepth: this.members.filter((m) => m.role === 'queued').length,
      queueEnabled: this.queueEnabled,
      mode: this.mode,
    });
    this.publishRoomState();
  }

  private roomState(): RoomState {
    return {
      game: this.game,
      hostUserId: this.hostUserId,
      queueEnabled: this.queueEnabled,
      matchInProgress: this.isMatchInProgress(),
      members: this.members.map(({ userId, role }) => ({ userId, role })),
    };
  }

  private publishRoomState(): boolean {
    const state = this.roomState();
    const serialized = JSON.stringify(state);
    if (serialized === this.publishedRoomState) return false;
    this.publishedRoomState = serialized;
    broadcastMessage<RoomServerMessage>(this, {
      type: ROOM_STATE,
      payload: state,
    });
    return true;
  }

  private afterOutbound() {
    this.maybeRotateAfterMatchEnd();
    this.publishRoomState();
  }

  private loadSession() {
    const ctx: AdapterContext = {
      roomKey: this.roomKeyValue,
      instanceId: this.identity.instanceId,
      guildId: this.identity.guildId,
      mode: this.mode,
      difficulty: this.identity.difficulty,
      winningScore: this.identity.winningScore,
      ruleset: this.identity.ruleset,
      options: this.identity.options,
      // Every match-ending state change — whether it lands here from an
      // `onMessage` handler or from an async path entirely outside one (e.g.
      // TicTacToeSession's disconnect-grace-timeout forfeit, which fires from
      // a bare `setTimeout`) — routes through one of this context's three
      // outbound primitives before reaching a client. Hooking
      // `maybeRotateAfterMatchEnd()` here, instead of only after the
      // originating `onMessage` handler returns, is what makes queue
      // rotation fire for the disconnect-forfeit path too. Deferred to a
      // microtask (via `Promise.resolve().then`, not called inline) so it
      // runs after the *entire* current synchronous call completes — calling
      // it inline here would re-enter `substitutePlayer()` while, e.g.,
      // `TicTacToeSession`'s own `forfeitTo()`/`handleMove()` is still using
      // its pre-rotation `players` array a few lines further down (for
      // `recordResult()`), corrupting whose result gets recorded.
      broadcast: (type: string, payload?: unknown) => {
        this.broadcast(type, payload);
        Promise.resolve().then(() => this.afterOutbound());
      },
      broadcastBinary: (type: string, data: Uint8Array) => {
        this.broadcastBytes(type, data, {});
        Promise.resolve().then(() => this.afterOutbound());
      },
      sendToPlayer: (userId: string, type: string, payload?: unknown) => {
        for (const client of this.clients) {
          if (client.auth?.userId !== userId) continue;
          client.send(type, payload);
        }
        Promise.resolve().then(() => this.afterOutbound());
      },
      onSessionEnded: () => this.disconnect(),
    };

    for (const unsubscribe of this.messageUnsubscribers) unsubscribe();
    this.messageUnsubscribers = [];

    this.ctx = ctx;
    const { session, messageHandlers, maxPlayers } = this.adapter.setup(ctx);
    this.session = session;
    this.setupMaxPlayers = maxPlayers;
    this.rateLimiters.clear();

    for (const [type, { rateLimit, handle }] of Object.entries(
      messageHandlers,
    )) {
      if (rateLimit) this.rateLimiters.set(type, new RateLimiter(rateLimit));
      const unsubscribe = this.onMessage(type, (client, payload) => {
        const limiter = this.rateLimiters.get(type);
        if (limiter?.isOverLimit(client)) return;
        const auth = requireAuth(client);
        // For a deliberate quit, try handing this seat straight to the
        // queue head BEFORE the adapter's own handler runs. `substitutePlayer`
        // requires the outgoing party to still be present in the session —
        // every queue-eligible session's own leave/disconnect handling
        // unconditionally drops that seat as part of processing the
        // departure (TicTacToeSession.leave() -> detach() -> removePlayer()
        // always runs, forfeit-and-remove, even when the match had already
        // concluded), so attempting the hand-off *after* `handle()` runs is
        // too late — there's no marker left to hand off by then.
        if (type === 'leave') this.tryHandoffDepartingPlayer(auth.userId);
        this.settle(handle(auth, client, payload), type);
        // A deliberate quit ('leave' — the same literal message name every
        // adapter uses for it) detaches the player inside the adapter's
        // handler immediately, but `this.members` otherwise wouldn't reflect
        // that until the real socket close later fires `onLeave` — which
        // normally follows right away, but isn't guaranteed. Special-cased
        // here so playerCount/isMatchInProgress/queue rotation stay in sync
        // without waiting for the socket to actually close.
        if (type === 'leave') this.handleMemberDeparture(auth.userId);
      });
      this.messageUnsubscribers.push(unsubscribe);
    }
  }

  // Host-only room controls. Registered once in onCreate (unlike the
  // per-adapter handlers in loadSession(), these never need to be torn down
  // and re-registered by switch_game — they route to the adapter indirectly
  // through `this.adapter`/`this.session`, which switch_game reassigns).
  private registerRoomLevelMessages() {
    this.onMessage('switch_game', (client: AuthedClient, payload: unknown) => {
      const auth = requireAuth(client);
      if (auth.userId !== this.hostUserId) {
        client.send(ACTION_REJECTED, {
          error: 'Only the host can switch games',
        });
        return;
      }
      if (this.isMatchInProgress()) {
        client.send(ACTION_REJECTED, {
          error: 'Cannot switch games mid-match',
        });
        return;
      }
      const parsed = switchGamePayloadSchema.safeParse(payload);
      const game = parsed.success ? parsed.data.game : null;
      if (!game || !SWITCHABLE_GAMES.has(game)) {
        client.send(ACTION_REJECTED, {
          error: 'Unknown or unswitchable game',
        });
        return;
      }
      this.switchGame(game);
    });

    this.onMessage('toggle_queue', (client: AuthedClient, payload: unknown) => {
      const auth = requireAuth(client);
      if (auth.userId !== this.hostUserId) {
        client.send(ACTION_REJECTED, {
          error: 'Only the host can toggle the queue',
        });
        return;
      }
      const parsed = toggleQueuePayloadSchema.safeParse(payload);
      if (!parsed.success) {
        client.send(ACTION_REJECTED, { error: 'Invalid queue toggle' });
        return;
      }
      this.queueEnabled = parsed.data.enabled;
      this.syncMetadata();
    });

    this.onMessage('rotate_seat', (client: AuthedClient) => {
      const auth = requireAuth(client);
      if (this.isMatchInProgress()) {
        client.send(ACTION_REJECTED, {
          error: 'Cannot rotate seats mid-match',
        });
        return;
      }
      const sender = this.members.find(
        (m) => m.userId === auth.userId && m.role === 'player',
      );
      if (!sender) {
        client.send(ACTION_REJECTED, {
          error: 'Only a seated player can rotate out',
        });
        return;
      }
      const queueHead = this.members.find((m) => m.role === 'queued');
      if (!queueHead) {
        client.send(ACTION_REJECTED, {
          error: 'No one is waiting in the queue',
        });
        return;
      }
      this.rotateSeat(sender.userId, queueHead.userId);
      // A manual rotation counts as "this match's rotation already
      // happened" exactly like the automatic one does — otherwise a later
      // broadcast for the same still-unrestarted match (e.g. a partial
      // restart vote) would find the guard untouched, see the same winner
      // still set, and auto-rotate the just-promoted player straight back
      // out.
      this.rotatedForCurrentMatch = true;
    });
  }

  // Prefers the per-instance value setup() returned (e.g. CardTable's
  // per-ruleset seat count) over the adapter's static field.
  private get maxPlayers(): number {
    return this.setupMaxPlayers ?? this.adapter.maxPlayers;
  }

  private isMatchInProgress(): boolean {
    if (!this.adapter.getWinnerUserId) return false;
    const playerCount = this.members.filter((m) => m.role === 'player').length;
    if (playerCount < this.maxPlayers) return false;
    return this.adapter.getWinnerUserId(this.session) === null;
  }

  private maybeRotateAfterMatchEnd() {
    if (!this.adapter.getWinnerUserId || !this.adapter.substitutePlayer) {
      return;
    }
    const winnerUserId = this.adapter.getWinnerUserId(this.session);
    if (!winnerUserId) {
      // Reset regardless of `queueEnabled` — otherwise toggling the queue
      // off across a match's conclusion and back on before the next one
      // would leave this guard stuck `true` from before, incorrectly
      // blocking the very next match's legitimate rotation.
      this.rotatedForCurrentMatch = false;
      return;
    }
    if (!this.queueEnabled || this.rotatedForCurrentMatch) return; // queue off, or already rotated for this match

    const loser = this.members.find(
      (m) => m.role === 'player' && m.userId !== winnerUserId,
    );
    const queueHead = this.members.find((m) => m.role === 'queued');
    if (!loser || !queueHead) return; // no one waiting — winner and loser stay seated for a rematch

    this.rotateSeat(loser.userId, queueHead.userId);
    this.rotatedForCurrentMatch = true;
  }

  private rotateSeat(outgoingUserId: string, incomingUserId: string) {
    const incomingClient = this.clients.find(
      (c) => c.auth?.userId === incomingUserId,
    );
    if (!incomingClient || !this.adapter.substitutePlayer) return;

    const ok = this.adapter.substitutePlayer(
      this.session,
      outgoingUserId,
      incomingUserId,
      incomingClient,
    );
    if (!ok) return;

    const outgoing = this.members.find((m) => m.userId === outgoingUserId);
    const incoming = this.members.find((m) => m.userId === incomingUserId);
    if (outgoing) outgoing.role = 'queued';
    if (incoming) incoming.role = 'player';
    // Re-seat the outgoing member at the back of the queue.
    this.members = [
      ...this.members.filter((m) => m.userId !== outgoingUserId),
      ...(outgoing ? [outgoing] : []),
    ];
    this.syncMetadata();
  }

  private assignSeat(): SeatRole {
    if (this.mode !== 'multi') return 'player';
    const playerCount = this.members.filter((m) => m.role === 'player').length;
    if (playerCount < this.maxPlayers) return 'player';
    if (this.queueEnabled && this.adapter.supportsQueue) return 'queued';
    return 'spectator';
  }

  // Shared by onJoin and switchGame's client-reseating loop: dedupes a
  // second connection under an already-seated userId (incrementing its
  // connection count instead of double-counting it toward `assignSeat()`).
  // Callers still call `adapter.onJoin` for every individual connection so
  // each socket gets its own `init` message.
  private admitMember(auth: WsSessionPayload): SeatRole {
    const existing = this.members.find((m) => m.userId === auth.userId);
    if (existing) {
      existing.connections += 1;
      return existing.role;
    }
    const role = this.assignSeat();
    this.members.push({ userId: auth.userId, role, connections: 1 });
    return role;
  }

  // room_state goes out before the adapter's `init`: the client mounts a
  // game's board only once room_state names the game, so anything sent
  // earlier would reach no board.
  override onJoin(
    client: AuthedClient,
    _options: unknown,
    auth: WsSessionPayload,
  ) {
    if (this.hostUserId === null) this.hostUserId = auth.userId;
    const role = this.admitMember(auth);
    const published = this.publishedRoomState;
    this.syncMetadata();
    if (this.publishedRoomState === published)
      sendMessage<RoomServerMessage>(client, {
        type: ROOM_STATE,
        payload: this.roomState(),
      });
    this.settle(
      this.adapter.onJoin(this.session, auth, client, role, this.ctx),
      'join',
    );
  }

  override onLeave(client: AuthedClient) {
    const auth = requireAuth(client);

    for (const limiter of this.rateLimiters.values()) limiter.clear(client);

    // Same ordering requirement as the 'leave'-message path below: a raw
    // socket close for a player whose match already concluded routes
    // through the adapter's own `onLeave` (TicTacToeSession.pauseForDisconnect,
    // which detaches immediately once a winner/draw already exists) and
    // that unconditionally drops the seat from the session — so the
    // hand-off attempt has to run first, while the seat is still there. Only
    // attempted when this is the userId's LAST tracked connection — a second
    // tab closing while the first stays open must not hand the seat away out
    // from under the tab that's still connected.
    const member = this.members.find((m) => m.userId === auth.userId);
    if (member && member.connections <= 1) {
      this.tryHandoffDepartingPlayer(auth.userId);
    }
    this.adapter.onLeave(this.session, auth, client);

    if (!member) return;
    member.connections -= 1;
    if (member.connections <= 0) this.handleMemberDeparture(auth.userId);
  }

  // Seats the queue head directly into a departing player's exact marker,
  // in place of them, BEFORE the adapter's own leave/disconnect handler
  // runs. This has to happen first: `substitutePlayer()` requires the
  // outgoing party to still be present in the session, and every
  // queue-eligible session's own departure handling (forfeit-then-remove)
  // unconditionally drops that seat as part of processing the departure —
  // by the time the adapter's handler returns, there's no marker left to
  // hand off. Only eligible once a winner already exists, matching
  // `substitutePlayer`'s own documented "between matches, never mid-match"
  // contract: a still-in-progress match's forfeit-by-departure is left
  // exactly as before (the opponent wins; the now-vacant seat is a
  // different problem — see this method's known-limitation note in the
  // task report — not one `substitutePlayer` can address, since there is no
  // seated "loser" marker left to swap once the departure itself is what
  // ended the match).
  private tryHandoffDepartingPlayer(userId: string): boolean {
    if (
      !this.queueEnabled ||
      !this.adapter.getWinnerUserId ||
      !this.adapter.substitutePlayer
    ) {
      return false;
    }
    const departing = this.members.find((m) => m.userId === userId);
    if (!departing || departing.role !== 'player') return false;

    const winnerUserId = this.adapter.getWinnerUserId(this.session);
    if (!winnerUserId || winnerUserId === userId) return false; // no concluded match to hand off, or the winner is the one leaving

    const queueHead = this.members.find((m) => m.role === 'queued');
    if (!queueHead) return false;
    const queueHeadClient = this.clients.find(
      (c) => c.auth?.userId === queueHead.userId,
    );
    if (!queueHeadClient) return false;

    const ok = this.adapter.substitutePlayer(
      this.session,
      userId,
      queueHead.userId,
      queueHeadClient,
    );
    if (!ok) return false;

    // Not routed through the generic rotateSeat() helper: that helper
    // assumes the outgoing party goes to the BACK of the queue, but this
    // user is leaving the room entirely — handleMemberDeparture() filters
    // them out below, they're never requeued.
    queueHead.role = 'player';
    this.rotatedForCurrentMatch = true;
    return true;
  }

  // Shared by the real socket-close `onLeave` and the `'leave'`-message
  // special case in `loadSession()`'s dispatch loop — whichever one notices
  // the departure first does the actual work; the other finds `userId`
  // already gone from `this.members` and no-ops, which is what makes calling
  // this from both places safe.
  private handleMemberDeparture(userId: string) {
    const member = this.members.find((m) => m.userId === userId);
    if (!member) return;

    const wasHost = userId === this.hostUserId;
    this.members = this.members.filter((m) => m.userId !== userId);
    if (wasHost && this.members.length > 0) {
      this.hostUserId = this.members[0]!.userId;
    }
    this.syncMetadata();
  }

  override onDispose() {
    this.adapter?.onDispose(this.session);
  }

  private switchGame(game: GameId) {
    this.adapter.onDispose(this.session);
    this.adapter = ADAPTER_REGISTRY[game]!;
    this.game = game;
    this.rotatedForCurrentMatch = false; // fresh session — no match has concluded yet
    this.loadSession();

    this.members = [];
    const seated = this.clients.map((client) => {
      const auth = requireAuth(client);
      return { client, auth, role: this.admitMember(auth) };
    });
    this.syncMetadata();
    for (const { client, auth, role } of seated)
      this.settle(
        this.adapter.onJoin(this.session, auth, client, role, this.ctx),
        'join',
      );
  }

  // DB-backed adapters (Wordle) answer asynchronously. Colyseus doesn't await
  // handlers, so a rejection has to be caught here or it crashes the process.
  private settle(result: void | Promise<void>, messageType: string) {
    if (!result) return;
    result.catch((error: unknown) =>
      logger.error('match_room.adapter_call_failed', {
        error,
        game: this.game,
        messageType,
      }),
    );
  }
}
