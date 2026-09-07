import type { Card } from 'services/activity/cards/core/card';
import { spanishSuitedDeck } from 'services/activity/cards/core/deckFactory';
import {
  MOVE_OK,
  moveRejected,
  type GameDefinition,
  type LegalMove,
  type ScoreboardEntry,
} from 'services/activity/cards/core/GameDefinition';
import { maskZones, type ZoneView } from 'services/activity/cards/core/masking';
import {
  opposingTeamSeats,
  owesResponse,
  type PendingResponse,
} from 'services/activity/cards/core/pendingResponse';
import { SeededRng } from 'services/activity/cards/core/rng';
import {
  isSeatActive,
  TurnOrder,
  type Seat,
} from 'services/activity/cards/core/seating';
import { Visibility } from 'services/activity/cards/core/zone';
import { ZoneSet } from 'services/activity/cards/core/zoneSet';
import {
  decisiveWinner,
  resolveHandWinner,
  type Team,
  type TrickResult,
} from 'services/activity/cards/rulesets/truco/handResolution';
import {
  cardStrength,
  manilhaRank,
} from 'services/activity/cards/rulesets/truco/ranking';

const SEAT_COUNT = 4;
const DEFAULT_WINNING_SCORE = 12;
const CARDS_PER_HAND = 3;
const MAX_STAKE = 12;
const TURN_TIMEOUT_MS = 60_000;

// Zone naming is this ruleset's business — the core engine never hardcodes zone
// ids, it only masks whatever the ruleset declared.
const HAND = (seatIndex: number) => `hand_${seatIndex}`;
const PLAYED = (seatIndex: number) => `played_${seatIndex}`;
const STOCK = 'stock';
const VIRA = 'vira';
const DISCARD = 'discard';

// What is at stake in an outstanding truco call. `stakeIfFolded` is the field
// the original state model was missing: the value awarded if the responding team
// runs is *not* the current stake, it's the previous bid on the ladder (fold a
// pending 6 and the caller takes 3, not 1).
export interface TrucoCall {
  level: number;
  stakeIfFolded: number;
}

export interface TrucoState {
  seats: Seat[];
  zones: ZoneSet;
  turn: TurnOrder;
  trickResults: TrickResult[];
  trickIndex: number;
  leadSeat: number;
  currentStake: number;
  // The team that owns the currently accepted stake. Only the *other* team may
  // raise it, which is what lets truco → retruco happen across tricks instead of
  // the stake being frozen after the first accept.
  stakeOwnerTeam: Team | null;
  pending: PendingResponse<TrucoCall> | null;
  matchScore: Record<Team, number>;
  handOver: boolean;
  // Set when a player abandons the match: their team loses regardless of score.
  forfeitedTeam: Team | null;
  winningScore: number;
  // Chained from the engine-issued seed so every deal in a match is reproducible
  // from the one seed recorded at match start.
  dealSeed: number;
}

interface PlayCardArgs {
  cardId: string;
}

function teamOfSeat(seats: readonly Seat[], seatIndex: number): Team {
  return seats.find((s) => s.seatIndex === seatIndex)?.teamId === 'B'
    ? 'B'
    : 'A';
}

function seatFor(state: TrucoState, playerId: string): Seat | undefined {
  return state.seats.find((s) => s.playerId === playerId);
}

function otherTeam(team: Team): Team {
  return team === 'A' ? 'B' : 'A';
}

// Module-level rather than reached through `this` inside the definition object:
// the engine is free to hold a reference to any single member, and a ruleset
// that depends on being called with a receiver breaks the moment it does.
function matchIsOver(state: TrucoState): boolean {
  if (state.forfeitedTeam !== null) return true;
  return (
    state.matchScore.A >= state.winningScore ||
    state.matchScore.B >= state.winningScore
  );
}

function playerIdOfSeat(
  seats: readonly Seat[],
  seatIndex: number,
): string | null {
  return seats.find((s) => s.seatIndex === seatIndex)?.playerId ?? null;
}

// Builds the zone layout and deals into it. Called by setup() and again by every
// redeal, so the zone set is always constructed the same way.
function dealInto(
  seats: readonly Seat[],
  seed: number,
): { zones: ZoneSet; nextSeed: number } {
  const rng = new SeededRng(seed);
  const deck = rng.shuffle(spanishSuitedDeck());
  const zones = new ZoneSet();

  let cursor = 0;
  for (const seat of seats) {
    const hand = deck.slice(cursor, cursor + CARDS_PER_HAND);
    cursor += CARDS_PER_HAND;
    // Owned by the player, visible only to them: the engine's maskZones() reads
    // this and nothing in this file hides a card by hand.
    zones.create(
      {
        id: HAND(seat.seatIndex),
        owner: seat.playerId ?? 'shared',
        visibility: Visibility.ownerOnly,
      },
      hand,
    );
    // One public pile per seat, so "who played what" is positional rather than
    // encoded in a parallel array.
    zones.create({
      id: PLAYED(seat.seatIndex),
      owner: 'shared',
      visibility: Visibility.public,
    });
  }

  zones.create(
    { id: VIRA, owner: 'shared', visibility: Visibility.public },
    deck.slice(cursor, cursor + 1),
  );
  cursor += 1;
  // The rest of the deck genuinely exists at the table; modelling it means the
  // card count adds up and a variant that draws from the stock has somewhere to
  // draw from.
  zones.create(
    { id: STOCK, owner: 'shared', visibility: Visibility.hidden },
    deck.slice(cursor),
  );
  zones.create({
    id: DISCARD,
    owner: 'shared',
    visibility: Visibility.topOnly,
  });

  return { zones, nextSeed: rng.nextInt(0x7fffffff) };
}

function viraCard(state: TrucoState): Card | undefined {
  return state.zones.get(VIRA)?.cards[0];
}

function currentManilha(state: TrucoState): string {
  const vira = viraCard(state);
  return manilhaRank(vira?.rank ?? '');
}

// Cards on the table this trick, as (seat, card) pairs read back out of the
// per-seat public zones.
function playedThisTrick(
  state: TrucoState,
): { seatIndex: number; card: Card }[] {
  const played: { seatIndex: number; card: Card }[] = [];
  for (const seat of state.seats) {
    const card = state.zones.get(PLAYED(seat.seatIndex))?.cards[0];
    if (card) played.push({ seatIndex: seat.seatIndex, card });
  }
  return played;
}

// Starts a fresh hand: new deal, trick state reset, stake back to 1, lead rotated.
function startHand(state: TrucoState, leadSeat: number): TrucoState {
  const { zones, nextSeed } = dealInto(state.seats, state.dealSeed);
  const turn = new TurnOrder(state.seats);
  turn.currentSeat = leadSeat;
  return {
    ...state,
    zones,
    turn,
    trickResults: [],
    trickIndex: 0,
    leadSeat,
    currentStake: 1,
    stakeOwnerTeam: null,
    pending: null,
    handOver: false,
    dealSeed: nextSeed,
  };
}

// Awards `points` to `winnerTeam`, then either deals the next hand or leaves the
// match in its terminal state.
function endHand(
  state: TrucoState,
  winnerTeam: Team,
  points: number,
): TrucoState {
  const matchScore: Record<Team, number> = {
    ...state.matchScore,
    [winnerTeam]: state.matchScore[winnerTeam] + points,
  };
  const settled: TrucoState = {
    ...state,
    matchScore,
    // Cleared on every hand end: a stale call left dangling on a finished match
    // is a move the responding team could still answer.
    pending: null,
    stakeOwnerTeam: null,
  };

  if (
    matchScore.A >= state.winningScore ||
    matchScore.B >= state.winningScore
  ) {
    return { ...settled, handOver: true };
  }
  return startHand(settled, (state.leadSeat + 1) % state.seats.length);
}

function resolveTrickIfComplete(state: TrucoState): TrucoState {
  const played = playedThisTrick(state);
  const activeSeats = state.seats.filter(isSeatActive).length;
  if (played.length < activeSeats) return state;

  const manilha = currentManilha(state);
  const strengths = played.map((entry) => ({
    ...entry,
    strength: cardStrength(entry.card, manilha),
  }));
  const maxStrength = Math.max(...strengths.map((s) => s.strength));
  const winners = strengths.filter((s) => s.strength === maxStrength);
  const trickResult: TrickResult =
    winners.length > 1 ? 'tie' : teamOfSeat(state.seats, winners[0]!.seatIndex);

  // Sweep the trick into the discard pile through the zone API, so the cards
  // stay accounted for instead of vanishing.
  const zones = state.zones.clone();
  const discard = zones.require(DISCARD);
  for (const entry of played) {
    const zone = zones.require(PLAYED(entry.seatIndex));
    zone.moveTo(discard, [entry.card.id]);
  }

  const trickResults = [...state.trickResults, trickResult];
  const nextLead =
    trickResult === 'tie' ? state.leadSeat : winners[0]!.seatIndex;
  const turn = state.turn.clone();
  turn.currentSeat = nextLead;

  const afterTrick: TrucoState = {
    ...state,
    zones,
    turn,
    trickResults,
    trickIndex: state.trickIndex + 1,
  };

  const handWinner =
    decisiveWinner(trickResults) ??
    (afterTrick.trickIndex >= CARDS_PER_HAND
      ? resolveHandWinner(trickResults, teamOfSeat(state.seats, state.leadSeat))
      : null);

  if (handWinner === null) return afterTrick;
  return endHand(afterTrick, handWinner, state.currentStake);
}

// The next rung on the truco ladder, and what the caller collects if the other
// team runs from it.
function nextCall(state: TrucoState): TrucoCall {
  const level = state.currentStake === 1 ? 3 : state.currentStake + 3;
  return {
    level: Math.min(level, MAX_STAKE),
    stakeIfFolded: state.currentStake,
  };
}

function openCall(
  state: TrucoState,
  callerSeat: number,
  call: TrucoCall,
): PendingResponse<TrucoCall> {
  return {
    initiatorSeat: callerSeat,
    respondingSeats: opposingTeamSeats(state.seats, callerSeat),
    allowedMoves:
      call.level < MAX_STAKE ? ['accept', 'fold', 'raise'] : ['accept', 'fold'],
    // Whoever was on turn keeps it once the call is settled — the negotiation
    // suspends the rotation, it doesn't reorder it.
    resumeSeat: state.turn.currentSeat,
    data: call,
  };
}

function respondentGuard(state: TrucoState, playerId: string) {
  const seat = seatFor(state, playerId);
  if (!seat) return moveRejected('Jogador não está na mesa');
  if (!state.pending) return moveRejected('Não há pedido de truco pendente');
  if (!owesResponse(state.pending, seat.seatIndex)) {
    return moveRejected('Só quem recebeu o pedido pode responder');
  }
  return MOVE_OK;
}

export interface TrucoView {
  seats: Seat[];
  hands: Record<number, ZoneView>;
  table: { seatIndex: number; card: Card }[];
  vira: Card | null;
  discardCount: number;
  trickResults: TrickResult[];
  currentSeat: number;
  currentStake: number;
  pendingCallLevel: number | null;
  callingTeam: Team | null;
  matchScore: Record<Team, number>;
  handOver: boolean;
  forfeitedTeam: Team | null;
  winningScore: number;
  legalMoves: LegalMove[];
}

// Builds a Truco GameDefinition for a given seat count. The rules — team
// assignment by seat parity, trick resolution, the call/raise/fold ladder —
// are identical whether a "team" is two players (dupla) or one (1v1); only
// the seat count differs between variants, so one factory serves both rather
// than duplicating the whole ruleset per variant.
function buildTrucoDefinition(
  id: string,
  seatCount: number,
): GameDefinition<TrucoState, TrucoView> {
  // Bound to a local so onTurnTimeout/maskStateFor below can call back into
  // this specific variant's own moves/legalMoves rather than always the
  // module-level `trucoDefinition` (which would be the wrong variant for
  // whichever definition this factory call is building).
  const definition: GameDefinition<TrucoState, TrucoView> = {
    id,
    minPlayers: seatCount,
    maxPlayers: seatCount,

    setup({ players, options, seed }) {
      const seats: Seat[] = players.map((p) => ({
        seatIndex: p.seatIndex,
        playerId: p.userId,
        teamId: p.seatIndex % 2 === 0 ? 'A' : 'B',
      }));
      // The ruleset reads what it understands out of the forwarded match options
      // and ignores the rest.
      const requested = (options as { winningScore?: unknown } | undefined)
        ?.winningScore;
      const winningScore =
        typeof requested === 'number' &&
        Number.isInteger(requested) &&
        requested >= 1 &&
        requested <= 24
          ? requested
          : DEFAULT_WINNING_SCORE;

      const base: TrucoState = {
        seats,
        zones: new ZoneSet(),
        turn: new TurnOrder(seats),
        trickResults: [],
        trickIndex: 0,
        leadSeat: 0,
        currentStake: 1,
        stakeOwnerTeam: null,
        pending: null,
        matchScore: { A: 0, B: 0 },
        handOver: false,
        forfeitedTeam: null,
        winningScore,
        dealSeed: seed,
      };
      return startHand(base, 0);
    },

    moves: {
      play_card: {
        parseArgs(raw): PlayCardArgs | null {
          const cardId = (raw as { cardId?: unknown } | undefined)?.cardId;
          return typeof cardId === 'string' && cardId.length > 0
            ? { cardId }
            : null;
        },
        validate(state, playerId, args) {
          if (state.pending)
            return moveRejected('Aguardando resposta ao truco');
          const seat = seatFor(state, playerId);
          if (!seat) return moveRejected('Jogador não está na mesa');
          if (seat.seatIndex !== state.turn.currentSeat) {
            return moveRejected('Não é sua vez');
          }
          const hand = state.zones.get(HAND(seat.seatIndex));
          if (!hand?.cards.some((c) => c.id === args.cardId)) {
            return moveRejected('Carta inválida');
          }
          return MOVE_OK;
        },
        apply(state, playerId, args) {
          const seat = seatFor(state, playerId)!;
          const zones = state.zones.clone();
          zones
            .require(HAND(seat.seatIndex))
            .moveTo(zones.require(PLAYED(seat.seatIndex)), [args.cardId]);
          const turn = state.turn.clone();
          turn.advance();
          return resolveTrickIfComplete({ ...state, zones, turn });
        },
      },

      call_truco: {
        validate(state, playerId) {
          if (state.pending) {
            return moveRejected('Já há um pedido de truco pendente');
          }
          if (state.currentStake >= MAX_STAKE) {
            return moveRejected('O valor máximo já foi atingido');
          }
          const seat = seatFor(state, playerId);
          if (!seat) return moveRejected('Jogador não está na mesa');
          if (seat.seatIndex !== state.turn.currentSeat) {
            return moveRejected('Não é sua vez');
          }
          // The team that owns the accepted stake can't bid against itself; the
          // team that accepted it is the one entitled to raise later.
          if (
            state.stakeOwnerTeam !== null &&
            teamOfSeat(state.seats, seat.seatIndex) === state.stakeOwnerTeam
          ) {
            return moveRejected('Sua equipe já pediu o valor atual');
          }
          return MOVE_OK;
        },
        apply(state, playerId) {
          const seat = seatFor(state, playerId)!;
          return {
            ...state,
            pending: openCall(state, seat.seatIndex, nextCall(state)),
          };
        },
      },

      raise: {
        validate(state, playerId) {
          const guard = respondentGuard(state, playerId);
          if (!guard.ok) return guard;
          if (state.pending!.data.level >= MAX_STAKE) {
            return moveRejected('O valor máximo já foi atingido');
          }
          return MOVE_OK;
        },
        apply(state, playerId) {
          const seat = seatFor(state, playerId)!;
          const current = state.pending!.data;
          const raised: TrucoCall = {
            level: Math.min(current.level + 3, MAX_STAKE),
            // Running from a raise pays the bid being raised over, not the stake
            // that was accepted before the ladder started.
            stakeIfFolded: current.level,
          };
          return {
            ...state,
            pending: {
              ...openCall(state, seat.seatIndex, raised),
              resumeSeat: state.pending!.resumeSeat,
            },
          };
        },
      },

      accept: {
        validate(state, playerId) {
          return respondentGuard(state, playerId);
        },
        apply(state, playerId) {
          const seat = seatFor(state, playerId)!;
          const pending = state.pending!;
          const turn = state.turn.clone();
          turn.currentSeat = pending.resumeSeat;
          return {
            ...state,
            currentStake: pending.data.level,
            // The caller's team owns the new stake, so only the accepting team may
            // raise it next.
            stakeOwnerTeam: otherTeam(teamOfSeat(state.seats, seat.seatIndex)),
            pending: null,
            turn,
          };
        },
      },

      fold: {
        validate(state, playerId) {
          return respondentGuard(state, playerId);
        },
        apply(state) {
          const pending = state.pending!;
          const winnerTeam = teamOfSeat(state.seats, pending.initiatorSeat);
          return endHand(state, winnerTeam, pending.data.stakeIfFolded);
        },
      },
    },

    legalMoves(state, playerId): LegalMove[] {
      if (state.handOver) return [];
      const seat = seatFor(state, playerId);
      if (!seat) return [];

      if (state.pending) {
        if (!owesResponse(state.pending, seat.seatIndex)) return [];
        return state.pending.allowedMoves.map((move) => ({ move }));
      }

      const moves: LegalMove[] = [];
      if (seat.seatIndex === state.turn.currentSeat) {
        for (const card of state.zones.get(HAND(seat.seatIndex))?.cards ?? []) {
          moves.push({ move: 'play_card', args: { cardId: card.id } });
        }
        const canCall =
          state.currentStake < MAX_STAKE &&
          (state.stakeOwnerTeam === null ||
            teamOfSeat(state.seats, seat.seatIndex) !== state.stakeOwnerTeam);
        if (canCall) moves.push({ move: 'call_truco' });
      }
      return moves;
    },

    isRoundOver(state) {
      return state.handOver;
    },

    isMatchOver(state) {
      return matchIsOver(state);
    },

    scoreboard(state): ScoreboardEntry[] {
      const winningTeam: Team =
        state.forfeitedTeam !== null
          ? otherTeam(state.forfeitedTeam)
          : state.matchScore.A >= state.matchScore.B
            ? 'A'
            : 'B';
      return state.seats
        .filter((s): s is Seat & { playerId: string } => s.playerId !== null)
        .map((seat) => ({
          userId: seat.playerId,
          position:
            teamOfSeat(state.seats, seat.seatIndex) === winningTeam ? 1 : 2,
          points: state.matchScore[teamOfSeat(state.seats, seat.seatIndex)],
        }));
    },

    maskStateFor(state, playerId): TrucoView {
      // Card hiding goes through the engine's one masking implementation. This
      // function only decides which *public* fields ride along.
      const zoneViews = maskZones(state.zones, playerId, state.seats);
      const hands: Record<number, ZoneView> = {};
      for (const seat of state.seats) {
        const view = zoneViews[HAND(seat.seatIndex)];
        if (view) hands[seat.seatIndex] = view;
      }
      return {
        seats: state.seats,
        hands,
        table: playedThisTrick(state),
        vira: viraCard(state) ?? null,
        discardCount: state.zones.get(DISCARD)?.size ?? 0,
        trickResults: state.trickResults,
        currentSeat: state.turn.currentSeat,
        currentStake: state.currentStake,
        pendingCallLevel: state.pending?.data.level ?? null,
        callingTeam: state.pending
          ? teamOfSeat(state.seats, state.pending.initiatorSeat)
          : null,
        matchScore: state.matchScore,
        handOver: state.handOver,
        forfeitedTeam: state.forfeitedTeam,
        winningScore: state.winningScore,
        legalMoves: playerId ? definition.legalMoves(state, playerId) : [],
      };
    },

    // A truco match (2v2 or 1v1) cannot continue with an empty seat, so a
    // walkout settles the match in favour of the other team rather than leaving
    // a seat that owes a turn nobody can take.
    onDisconnectForfeit(state, userId) {
      const seat = seatFor(state, userId);
      if (!seat) return null;
      return {
        ...state,
        forfeitedTeam: teamOfSeat(state.seats, seat.seatIndex),
        pending: null,
        handOver: true,
      };
    },

    turnTimeoutMs: TURN_TIMEOUT_MS,

    playersToAct(state) {
      if (matchIsOver(state)) return [];
      if (state.pending) {
        return state.pending.respondingSeats
          .map((seatIndex) => playerIdOfSeat(state.seats, seatIndex))
          .filter((id): id is string => id !== null);
      }
      const current = playerIdOfSeat(state.seats, state.turn.currentSeat);
      return current ? [current] : [];
    },

    // Idling is not a way to stall the table: an unanswered call is treated as
    // running from it, and an unplayed turn plays the leftmost card.
    onTurnTimeout(state, userId) {
      const seat = seatFor(state, userId);
      if (!seat) return state;
      if (state.pending && owesResponse(state.pending, seat.seatIndex)) {
        return definition.moves.fold!.apply(state, userId, undefined);
      }
      if (seat.seatIndex !== state.turn.currentSeat) return state;
      const card = state.zones.get(HAND(seat.seatIndex))?.cards[0];
      if (!card) return state;
      return definition.moves.play_card!.apply(state, userId, {
        cardId: card.id,
      });
    },
  };
  return definition;
}

export const trucoDefinition = buildTrucoDefinition('truco', SEAT_COUNT);
export const truco1v1Definition = buildTrucoDefinition('truco-1v1', 2);
