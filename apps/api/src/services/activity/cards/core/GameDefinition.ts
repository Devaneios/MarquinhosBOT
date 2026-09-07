// The contract every concrete card game (Truco, Uno, War, a homebrew TCG, ...)
// implements to plug into the generic engine. TState is fully opaque outside the
// definition — CardTableSession never inspects it, only calls these functions.
// This is the mechanism that makes the foundation agnostic: different games
// differ only in which GameDefinition is loaded, nothing else in the stack
// branches on game identity.
//
// ─── The mutability contract ───────────────────────────────────────────────
// `apply` is PURE: it must return a new state and must not mutate the state it
// was given. The engine relies on this — a rejected move leaves the previous
// state intact, and a state can be held, compared or logged after the fact.
//
// The core primitives (Deck, Zone, ZoneSet, TurnOrder) are mutable classes, so
// they honour that contract through `clone()`, not through spread-copying: a
// `{...state}` shallow copy aliases the *same* Zone objects and would rewrite
// history in place. A ruleset holding primitives in its state therefore starts
// apply() with an explicit clone:
//
//     apply(state, playerId, args) {
//       const zones = state.zones.clone();   // deep-clones every Zone
//       const turn = state.turn.clone();
//       zones.require('hand_0').moveTo(zones.require('table'), [args.cardId]);
//       turn.advance();
//       return { ...state, zones, turn };
//     }
//
// Getting this wrong fails silently rather than loudly, which is why it is
// spelled out here and why every primitive that holds cards has a clone().
import type { LegalMove } from 'services/activity/cards/core/legalMove';

export type { LegalMove };

export interface ScoreboardEntry {
  userId: string;
  position: number;
  points?: number;
}

// A discriminated result rather than `true | { reason }`: rulesets touch this on
// every move, and `if (result !== true)` reads like a mistake even when it isn't.
export type MoveResult = { ok: true } | { ok: false; reason: string };

export const MOVE_OK: MoveResult = { ok: true };

export function moveRejected(reason: string): MoveResult {
  return { ok: false, reason };
}

export interface MoveDefinition<TState, TArgs = void> {
  // Turns the raw client payload into this move's arg type, or null to reject it
  // before any rule logic runs. This is the boundary where `unknown` stops:
  // without it every validate()/apply() casts an untrusted payload to a shape it
  // merely hopes is right. Argless moves omit it and get `void` args.
  parseArgs?(raw: unknown): TArgs | null;
  validate(state: TState, playerId: string, args: TArgs): MoveResult;
  // Must not mutate `state` — see the mutability contract above.
  apply(state: TState, playerId: string, args: TArgs): TState;
}

// The moves map holds moves with differing arg types, which no single type
// parameter can express; `any` here is what lets each MoveDefinition declare its
// own precise TArgs while still living in one record.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyMoveDefinition<TState> = MoveDefinition<TState, any>;

export interface SetupContext {
  players: { userId: string; seatIndex: number }[];
  // Ruleset-specific match options, forwarded from the ws-session token. Each
  // ruleset reads what it understands and ignores the rest.
  options: unknown;
  // Issued by the engine, not by the ruleset, so it can be recorded alongside
  // the result and the deal replayed. A ruleset that mints its own seed
  // internally cannot be audited — see SeededRng.
  seed: number;
}

export interface GameDefinition<TState, TView = unknown> {
  id: string;
  minPlayers: number;
  maxPlayers: number;

  setup(ctx: SetupContext): TState;

  moves: Record<string, AnyMoveDefinition<TState>>;

  // Drives the client's "only show valid actions" UI: the server tells the
  // client which moves are currently legal (and, for simple cases, their args)
  // so the generic table renders exactly the right buttons without any per-game
  // UI logic.
  legalMoves(state: TState, playerId: string): LegalMove[];

  // A hand/trick/round boundary, as opposed to the match ending. The engine
  // announces the transition so a client can hold the round result on screen
  // before the next deal replaces it.
  isRoundOver(state: TState): boolean;
  isMatchOver(state: TState): boolean;

  // Feeds GamificationService.recordGameResult unchanged — position ties
  // (teammates sharing a position) are expected and already tolerated there.
  scoreboard(state: TState): ScoreboardEntry[];

  // THE per-client masking function — null playerId means a spectator view.
  // Must never leak another player's hidden cards; compose core/masking.ts's
  // maskZones() rather than hand-rolling the hiding, so the engine's only
  // security boundary has one tested implementation.
  //
  // TView is this ruleset's published server→client contract. A type parameter
  // rather than `unknown`, so the shape the client renders is checked on the way
  // out instead of being reconstructed by hand on the other side.
  maskStateFor(state: TState, playerId: string | null): TView;

  // How this ruleset wants a walkout handled: return the settled state (a
  // forfeit), or null to let the match continue short-handed.
  //
  // There is deliberately no engine-level default. The engine cannot invent one
  // without inspecting an opaque TState, and a ruleset that lets an abandoned
  // match run produces a table nobody can play — the empty seat still owes a
  // turn that will never come. CardTableSession logs when a definition omits
  // this rather than silently claiming to have forfeited.
  onDisconnectForfeit?(state: TState, userId: string): TState | null;

  // Turn clock. Without one, a player who simply sits there stalls the table
  // forever: the disconnect grace period only covers sockets that actually drop.
  // All three are needed together before the engine arms it — `playersToAct` is
  // the part it cannot derive from an opaque TState.
  turnTimeoutMs?: number;
  playersToAct?(state: TState): string[];
  onTurnTimeout?(state: TState, userId: string): TState;

  // Ruleset-specific move selection for a CPU opponent. Move choice is
  // inherently game-specific (unlike Pong's physics-based paddle AI), so it
  // belongs on the definition rather than in CardTableSession.
  //
  // NOT YET DRIVEN BY THE ENGINE: CardTableSession has no notion of a seat held
  // by a bot rather than by a connection, so nothing calls this today. It is
  // declared because it is part of the intended seam — but don't implement it
  // expecting it to run; wiring it up means adding bot seats to the session
  // first.
  bot?: {
    chooseMove(state: TState, playerId: string): LegalMove | null;
  };
}
