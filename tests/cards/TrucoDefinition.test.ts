import { describe, expect, it } from 'bun:test';
import type { Card } from 'services/activity/cards/core/card';
import { isHidden } from 'services/activity/cards/core/masking';
import type { Seat } from 'services/activity/cards/core/seating';
import { TurnOrder } from 'services/activity/cards/core/seating';
import { Visibility } from 'services/activity/cards/core/zone';
import { ZoneSet } from 'services/activity/cards/core/zoneSet';
import {
  truco1v1Definition,
  trucoDefinition,
  type TrucoState,
} from 'services/activity/cards/rulesets/truco/TrucoDefinition';

const PLAYERS = [
  { userId: 'p1', seatIndex: 0 },
  { userId: 'p2', seatIndex: 1 },
  { userId: 'p3', seatIndex: 2 },
  { userId: 'p4', seatIndex: 3 },
];

const SEATS: Seat[] = [
  { seatIndex: 0, playerId: 'p1', teamId: 'A' },
  { seatIndex: 1, playerId: 'p2', teamId: 'B' },
  { seatIndex: 2, playerId: 'p3', teamId: 'A' },
  { seatIndex: 3, playerId: 'p4', teamId: 'B' },
];

// Hands chosen so seat 0 holds the strongest card with vira K (manilha = A).
const HANDS: Record<number, Card[]> = {
  0: [{ id: 'c1', suit: 'paus', rank: '3' }],
  1: [{ id: 'c2', suit: 'copas', rank: '4' }],
  2: [{ id: 'c3', suit: 'ouros', rank: '5' }],
  3: [{ id: 'c4', suit: 'espadas', rank: '6' }],
};

function baseState(overrides: Partial<TrucoState> = {}): TrucoState {
  const zones = new ZoneSet();
  for (const seat of SEATS) {
    zones.create(
      {
        id: `hand_${seat.seatIndex}`,
        owner: seat.playerId!,
        visibility: Visibility.ownerOnly,
      },
      HANDS[seat.seatIndex],
    );
    zones.create({
      id: `played_${seat.seatIndex}`,
      owner: 'shared',
      visibility: Visibility.public,
    });
  }
  zones.create(
    { id: 'vira', owner: 'shared', visibility: Visibility.public },
    [{ id: 'vira-card', suit: 'ouros', rank: 'K' }], // manilha rank = 'A'
  );
  zones.create({ id: 'stock', owner: 'shared', visibility: Visibility.hidden });
  zones.create({
    id: 'discard',
    owner: 'shared',
    visibility: Visibility.topOnly,
  });

  const turn = new TurnOrder(SEATS);
  return {
    seats: SEATS,
    zones,
    turn,
    trickResults: [],
    trickIndex: 0,
    leadSeat: 0,
    currentStake: 1,
    stakeOwnerTeam: null,
    pending: null,
    matchScore: { A: 0, B: 0 },
    handOver: false,
    forfeitedTeam: null,
    winningScore: 12,
    dealSeed: 7,
    ...overrides,
  };
}

function handOf(state: TrucoState, seatIndex: number): Card[] {
  return [...(state.zones.get(`hand_${seatIndex}`)?.cards ?? [])];
}

function play(state: TrucoState, playerId: string, cardId: string): TrucoState {
  const move = trucoDefinition.moves.play_card!;
  const args = move.parseArgs!({ cardId });
  expect(args).not.toBeNull();
  expect(move.validate(state, playerId, args).ok).toBe(true);
  return move.apply(state, playerId, args);
}

describe('trucoDefinition.setup', () => {
  it('deals 3 cards to each of the 4 seats, assigns teams and draws a vira', () => {
    const state = trucoDefinition.setup({
      players: PLAYERS,
      options: {},
      seed: 1,
    });
    for (const seat of state.seats) {
      expect(handOf(state, seat.seatIndex)).toHaveLength(3);
    }
    expect(state.seats.map((s) => s.teamId)).toEqual(['A', 'B', 'A', 'B']);
    expect(state.zones.require('vira').size).toBe(1);
    expect(state.currentStake).toBe(1);
    expect(state.trickResults).toEqual([]);
  });

  it('accounts for all 40 cards across the declared zones', () => {
    const state = trucoDefinition.setup({
      players: PLAYERS,
      options: {},
      seed: 1,
    });
    const total = state.zones.all().reduce((sum, zone) => sum + zone.size, 0);
    expect(total).toBe(40);
  });

  it('is reproducible from its seed', () => {
    // The point of engine-issued seeds: the same seed deals the same cards, ids
    // included, so a reported hand can be replayed.
    const a = trucoDefinition.setup({
      players: PLAYERS,
      options: {},
      seed: 99,
    });
    const b = trucoDefinition.setup({
      players: PLAYERS,
      options: {},
      seed: 99,
    });
    expect(handOf(a, 0).map((c) => c.id)).toEqual(
      handOf(b, 0).map((c) => c.id),
    );

    const different = trucoDefinition.setup({
      players: PLAYERS,
      options: {},
      seed: 100,
    });
    expect(handOf(different, 0).map((c) => c.id)).not.toEqual(
      handOf(a, 0).map((c) => c.id),
    );
  });

  it('honours a winningScore passed through the match options', () => {
    const state = trucoDefinition.setup({
      players: PLAYERS,
      options: { winningScore: 4 },
      seed: 1,
    });
    expect(state.winningScore).toBe(4);
    expect(
      trucoDefinition.isMatchOver({ ...state, matchScore: { A: 4, B: 0 } }),
    ).toBe(true);
  });

  it('ignores a nonsensical winningScore rather than trusting the client', () => {
    for (const winningScore of [0, -3, 999, 'twelve']) {
      const state = trucoDefinition.setup({
        players: PLAYERS,
        options: { winningScore },
        seed: 1,
      });
      expect(state.winningScore).toBe(12);
    }
  });
});

describe('play_card move', () => {
  it('rejects a payload with no card id before any rule logic runs', () => {
    expect(trucoDefinition.moves.play_card!.parseArgs!({})).toBeNull();
    expect(
      trucoDefinition.moves.play_card!.parseArgs!({ cardId: 7 }),
    ).toBeNull();
  });

  it('rejects a play from a seat whose turn it is not', () => {
    const state = baseState();
    const result = trucoDefinition.moves.play_card!.validate(state, 'p2', {
      cardId: 'c2',
    });
    expect(result).toEqual({ ok: false, reason: 'Não é sua vez' });
  });

  it('rejects a card the player does not hold', () => {
    const state = baseState();
    const result = trucoDefinition.moves.play_card!.validate(state, 'p1', {
      cardId: 'c4',
    });
    expect(result.ok).toBe(false);
  });

  it('rejects playing while a truco call is awaiting response', () => {
    const state = baseState({
      pending: {
        initiatorSeat: 1,
        respondingSeats: [0, 2],
        allowedMoves: ['accept', 'fold', 'raise'],
        resumeSeat: 0,
        data: { level: 3, stakeIfFolded: 1 },
      },
    });
    const result = trucoDefinition.moves.play_card!.validate(state, 'p1', {
      cardId: 'c1',
    });
    expect(result.ok).toBe(false);
  });

  it("moves the card from hand to that seat's table zone and advances the turn", () => {
    const next = play(baseState(), 'p1', 'c1');
    expect(handOf(next, 0)).toHaveLength(0);
    expect(next.zones.require('played_0').cards[0]?.id).toBe('c1');
    expect(next.turn.currentSeat).toBe(1);
  });

  it('does not mutate the state it was given', () => {
    // GameDefinition.apply's contract. With mutable primitives in the state this
    // only holds because apply() clones them first.
    const before = baseState();
    play(before, 'p1', 'c1');
    expect(handOf(before, 0).map((c) => c.id)).toEqual(['c1']);
    expect(before.zones.require('played_0').size).toBe(0);
    expect(before.turn.currentSeat).toBe(0);
  });

  it('resolves the trick once all 4 seats have played, crediting the stronger card', () => {
    let state = baseState();
    state = play(state, 'p1', 'c1'); // paus 3 — strongest here
    state = play(state, 'p2', 'c2');
    state = play(state, 'p3', 'c3');
    state = play(state, 'p4', 'c4');

    expect(state.trickResults).toEqual(['A']);
    expect(state.trickIndex).toBe(1);
    expect(state.turn.currentSeat).toBe(0); // trick winner leads the next one
    // Cards are swept into the discard rather than vanishing.
    expect(state.zones.require('played_0').size).toBe(0);
    expect(state.zones.require('discard').size).toBe(4);
  });

  it('ends the hand and scores it once a team wins 2 tricks outright', () => {
    let state = baseState({ trickResults: ['A'], trickIndex: 1 });
    state = play(state, 'p1', 'c1');
    state = play(state, 'p2', 'c2');
    state = play(state, 'p3', 'c3');
    state = play(state, 'p4', 'c4');

    expect(state.matchScore.A).toBe(1);
    expect(state.matchScore.B).toBe(0);
    // A fresh hand is dealt, so play continues.
    expect(handOf(state, 0)).toHaveLength(3);
    expect(state.currentStake).toBe(1);
  });
});

describe('truco call/accept/raise/fold', () => {
  const pendingAt = (level: number, stakeIfFolded: number, initiator = 0) =>
    baseState({
      pending: {
        initiatorSeat: initiator,
        respondingSeats: initiator % 2 === 0 ? [1, 3] : [0, 2],
        allowedMoves:
          level < 12 ? ['accept', 'fold', 'raise'] : ['accept', 'fold'],
        resumeSeat: 0,
        data: { level, stakeIfFolded },
      },
      currentStake: stakeIfFolded,
    });

  it('call_truco opens a pending call at level 3 owed by the other team', () => {
    const next = trucoDefinition.moves.call_truco!.apply(
      baseState(),
      'p1',
      undefined,
    );
    expect(next.pending?.data.level).toBe(3);
    expect(next.pending?.data.stakeIfFolded).toBe(1);
    expect(next.pending?.initiatorSeat).toBe(0);
    expect(next.pending?.respondingSeats).toEqual([1, 3]);
  });

  it('only the team that owes a response may accept, raise or fold', () => {
    const state = pendingAt(3, 1);
    for (const move of ['accept', 'raise', 'fold'] as const) {
      expect(
        trucoDefinition.moves[move]!.validate(state, 'p1', undefined).ok,
      ).toBe(false); // team A called
      expect(
        trucoDefinition.moves[move]!.validate(state, 'p2', undefined).ok,
      ).toBe(true); // team B owes
    }
  });

  it('raise escalates the level and flips whose team must respond', () => {
    const next = trucoDefinition.moves.raise!.apply(
      pendingAt(3, 1),
      'p2',
      undefined,
    );
    expect(next.pending?.data.level).toBe(6);
    expect(next.pending?.initiatorSeat).toBe(1);
    expect(next.pending?.respondingSeats).toEqual([0, 2]);
  });

  it('rejects raising past 12', () => {
    expect(
      trucoDefinition.moves.raise!.validate(pendingAt(12, 9), 'p2', undefined)
        .ok,
    ).toBe(false);
  });

  it('accept resolves the level into the stake and resumes the interrupted turn', () => {
    const state = pendingAt(6, 3);
    const next = trucoDefinition.moves.accept!.apply(state, 'p2', undefined);
    expect(next.currentStake).toBe(6);
    expect(next.pending).toBeNull();
    expect(next.turn.currentSeat).toBe(state.pending!.resumeSeat);
    // The caller's team owns the accepted stake, so only the accepting team may
    // raise it next.
    expect(next.stakeOwnerTeam).toBe('A');
  });

  describe('fold payout', () => {
    it('pays 1 when running from the opening truco', () => {
      const next = trucoDefinition.moves.fold!.apply(
        pendingAt(3, 1),
        'p2',
        undefined,
      );
      expect(next.matchScore.A).toBe(1);
      expect(next.matchScore.B).toBe(0);
    });

    it('pays 3 when running from a raise to 6, not 1', () => {
      // Truco's actual rule: running from a bid pays the opponent the *previous*
      // bid. Awarding `currentStake` pays 1 for every fold, because the stake
      // only moves on an accept.
      const next = trucoDefinition.moves.fold!.apply(
        pendingAt(6, 3, 1),
        'p1',
        undefined,
      );
      expect(next.matchScore.B).toBe(3);
      expect(next.matchScore.A).toBe(0);
    });

    it('pays 6 at a pending 9 and 9 at a pending 12', () => {
      expect(
        trucoDefinition.moves.fold!.apply(pendingAt(9, 6), 'p2', undefined)
          .matchScore.A,
      ).toBe(6);
      expect(
        trucoDefinition.moves.fold!.apply(pendingAt(12, 9), 'p2', undefined)
          .matchScore.A,
      ).toBe(9);
    });

    it('redeals after a fold that does not end the match', () => {
      const next = trucoDefinition.moves.fold!.apply(
        pendingAt(3, 1),
        'p2',
        undefined,
      );
      expect(handOf(next, 0)).toHaveLength(3);
      expect(next.pending).toBeNull();
      expect(next.currentStake).toBe(1);
    });
  });

  describe('re-raising a hand after an accept', () => {
    it('lets the team that accepted raise later in the hand', () => {
      // With the stake frozen at "currentStake must be 1", truco → retruco was
      // impossible: one call per hand, forever.
      const state = baseState({ currentStake: 3, stakeOwnerTeam: 'A' });
      expect(
        trucoDefinition.moves.call_truco!.validate(state, 'p1', undefined).ok,
      ).toBe(false); // team A already owns this stake
      const onTurn = baseState({
        currentStake: 3,
        stakeOwnerTeam: 'A',
        turn: (() => {
          const t = new TurnOrder(SEATS);
          t.currentSeat = 1;
          return t;
        })(),
      });
      expect(
        trucoDefinition.moves.call_truco!.validate(onTurn, 'p2', undefined).ok,
      ).toBe(true);
      const next = trucoDefinition.moves.call_truco!.apply(
        onTurn,
        'p2',
        undefined,
      );
      expect(next.pending?.data.level).toBe(6);
      expect(next.pending?.data.stakeIfFolded).toBe(3);
    });

    it('refuses a call once the stake is already at the maximum', () => {
      const state = baseState({ currentStake: 12, stakeOwnerTeam: 'B' });
      expect(
        trucoDefinition.moves.call_truco!.validate(state, 'p1', undefined).ok,
      ).toBe(false);
    });
  });

  it('clears a dangling call when the hand ends', () => {
    // A pending call surviving into a finished match is a move the responding
    // team could still answer.
    const state = pendingAt(3, 1);
    const next = trucoDefinition.moves.fold!.apply(
      { ...state, matchScore: { A: 11, B: 0 } },
      'p2',
      undefined,
    );
    expect(trucoDefinition.isMatchOver(next)).toBe(true);
    expect(next.pending).toBeNull();
    expect(next.handOver).toBe(true);
  });
});

describe('legalMoves', () => {
  it('offers play_card and call_truco to the player whose turn it is', () => {
    const moves = trucoDefinition.legalMoves(baseState(), 'p1');
    expect(moves.filter((m) => m.move === 'play_card')).toHaveLength(1);
    expect(moves.some((m) => m.move === 'call_truco')).toBe(true);
  });

  it('offers nothing to a player who is not up and has no call to answer', () => {
    expect(trucoDefinition.legalMoves(baseState(), 'p2')).toEqual([]);
  });

  it('offers exactly the pending response moves to the team that owes one', () => {
    const state = baseState({
      pending: {
        initiatorSeat: 0,
        respondingSeats: [1, 3],
        allowedMoves: ['accept', 'fold', 'raise'],
        resumeSeat: 0,
        data: { level: 3, stakeIfFolded: 1 },
      },
    });
    expect(
      trucoDefinition
        .legalMoves(state, 'p2')
        .map((m) => m.move)
        .sort(),
    ).toEqual(['accept', 'fold', 'raise']);
    expect(trucoDefinition.legalMoves(state, 'p1')).toEqual([]);
  });

  it('offers nothing once the match is over', () => {
    expect(
      trucoDefinition.legalMoves(baseState({ handOver: true }), 'p1'),
    ).toEqual([]);
  });
});

describe('scoreboard and match end', () => {
  it('isMatchOver is true once a team reaches the winning score', () => {
    expect(
      trucoDefinition.isMatchOver(baseState({ matchScore: { A: 12, B: 5 } })),
    ).toBe(true);
    expect(
      trucoDefinition.isMatchOver(baseState({ matchScore: { A: 11, B: 5 } })),
    ).toBe(false);
  });

  it('gives position 1 to the winning team and 2 to the other', () => {
    const board = trucoDefinition.scoreboard(
      baseState({ matchScore: { A: 12, B: 5 } }),
    );
    expect(board).toEqual([
      { userId: 'p1', position: 1, points: 12 },
      { userId: 'p2', position: 2, points: 5 },
      { userId: 'p3', position: 1, points: 12 },
      { userId: 'p4', position: 2, points: 5 },
    ]);
  });
});

describe('walkouts', () => {
  it('forfeits the match to the other team when a player abandons it', () => {
    // A 2v2 partnership game cannot continue three-handed: without this the
    // empty seat still owes a turn nobody can take, and the table is dead.
    const state = trucoDefinition.onDisconnectForfeit!(baseState(), 'p2');
    expect(state).not.toBeNull();
    expect(state!.forfeitedTeam).toBe('B');
    expect(trucoDefinition.isMatchOver(state!)).toBe(true);
    expect(
      trucoDefinition.scoreboard(state!).find((e) => e.userId === 'p1')
        ?.position,
    ).toBe(1);
    expect(
      trucoDefinition.scoreboard(state!).find((e) => e.userId === 'p2')
        ?.position,
    ).toBe(2);
  });

  it('ignores a walkout from someone who was never seated', () => {
    expect(
      trucoDefinition.onDisconnectForfeit!(baseState(), 'nobody'),
    ).toBeNull();
  });
});

describe('turn clock', () => {
  it('names the player whose turn it is', () => {
    expect(trucoDefinition.playersToAct!(baseState())).toEqual(['p1']);
  });

  it('names everyone who owes a response to a pending call', () => {
    const state = baseState({
      pending: {
        initiatorSeat: 0,
        respondingSeats: [1, 3],
        allowedMoves: ['accept', 'fold', 'raise'],
        resumeSeat: 0,
        data: { level: 3, stakeIfFolded: 1 },
      },
    });
    expect(trucoDefinition.playersToAct!(state)).toEqual(['p2', 'p4']);
  });

  it('nobody is left to act once the match is over', () => {
    expect(
      trucoDefinition.playersToAct!(baseState({ matchScore: { A: 12, B: 0 } })),
    ).toEqual([]);
  });

  it('plays a card for a player who lets the clock run out', () => {
    const next = trucoDefinition.onTurnTimeout!(baseState(), 'p1');
    expect(handOf(next, 0)).toHaveLength(0);
    expect(next.turn.currentSeat).toBe(1);
  });

  it('treats an unanswered call as running from it', () => {
    const state = baseState({
      pending: {
        initiatorSeat: 0,
        respondingSeats: [1, 3],
        allowedMoves: ['accept', 'fold', 'raise'],
        resumeSeat: 0,
        data: { level: 3, stakeIfFolded: 1 },
      },
    });
    const next = trucoDefinition.onTurnTimeout!(state, 'p2');
    expect(next.matchScore.A).toBe(1);
    expect(next.pending).toBeNull();
  });
});

describe('maskStateFor', () => {
  it("reveals the viewer's own hand and only the count of everyone else's", () => {
    const view = trucoDefinition.maskStateFor(baseState(), 'p1');
    expect(view.hands[0]!.cards.every((c) => !isHidden(c))).toBe(true);
    expect(view.hands[1]!.cards.every(isHidden)).toBe(true);
    expect(view.hands[1]!.count).toBe(1);
  });

  it("never serializes another seat's card into a player's view", () => {
    const view = trucoDefinition.maskStateFor(baseState(), 'p1');
    expect(JSON.stringify(view)).not.toContain('c2');
  });

  it('hides every hand from a spectator', () => {
    const view = trucoDefinition.maskStateFor(baseState(), null);
    for (const seat of SEATS) {
      expect(view.hands[seat.seatIndex]!.cards.every(isHidden)).toBe(true);
    }
    expect(view.legalMoves).toEqual([]);
  });

  it('publishes the public table state every ruleset UI needs', () => {
    const played = play(baseState(), 'p1', 'c1');
    const view = trucoDefinition.maskStateFor(played, 'p2');
    expect(view.table).toEqual([{ seatIndex: 0, card: HANDS[0]![0]! }]);
    expect(view.vira?.rank).toBe('K');
    expect(view.currentSeat).toBe(1);
    expect(view.currentStake).toBe(1);
    expect(view.matchScore).toEqual({ A: 0, B: 0 });
  });

  it('reports the pending call level and which team called it', () => {
    const state = baseState({
      pending: {
        initiatorSeat: 1,
        respondingSeats: [0, 2],
        allowedMoves: ['accept', 'fold', 'raise'],
        resumeSeat: 0,
        data: { level: 6, stakeIfFolded: 3 },
      },
    });
    const view = trucoDefinition.maskStateFor(state, 'p1');
    expect(view.pendingCallLevel).toBe(6);
    expect(view.callingTeam).toBe('B');
  });
});

// ─── truco1v1Definition: same engine, 2 solo seats instead of 4 in two teams ──

const PLAYERS_1V1 = [
  { userId: 'p1', seatIndex: 0 },
  { userId: 'p2', seatIndex: 1 },
];

const SEATS_1V1: Seat[] = [
  { seatIndex: 0, playerId: 'p1', teamId: 'A' },
  { seatIndex: 1, playerId: 'p2', teamId: 'B' },
];

function zonesFor(hands: Record<number, Card[]>): ZoneSet {
  const zones = new ZoneSet();
  for (const seat of SEATS_1V1) {
    zones.create(
      {
        id: `hand_${seat.seatIndex}`,
        owner: seat.playerId!,
        visibility: Visibility.ownerOnly,
      },
      hands[seat.seatIndex],
    );
    zones.create({
      id: `played_${seat.seatIndex}`,
      owner: 'shared',
      visibility: Visibility.public,
    });
  }
  zones.create(
    { id: 'vira', owner: 'shared', visibility: Visibility.public },
    [{ id: 'vira-card', suit: 'ouros', rank: 'K' }], // manilha rank = 'A'
  );
  zones.create({ id: 'stock', owner: 'shared', visibility: Visibility.hidden });
  zones.create({
    id: 'discard',
    owner: 'shared',
    visibility: Visibility.topOnly,
  });
  return zones;
}

function baseState1v1(overrides: Partial<TrucoState> = {}): TrucoState {
  return {
    seats: SEATS_1V1,
    zones: zonesFor({
      0: [{ id: 'w1', suit: 'paus', rank: '3' }],
      1: [{ id: 'w2', suit: 'copas', rank: '4' }],
    }),
    turn: new TurnOrder(SEATS_1V1),
    trickResults: [],
    trickIndex: 0,
    leadSeat: 0,
    currentStake: 1,
    stakeOwnerTeam: null,
    pending: null,
    matchScore: { A: 0, B: 0 },
    handOver: false,
    forfeitedTeam: null,
    winningScore: 12,
    dealSeed: 7,
    ...overrides,
  };
}

describe('truco1v1Definition', () => {
  it('requires exactly 2 players', () => {
    expect(truco1v1Definition.minPlayers).toBe(2);
    expect(truco1v1Definition.maxPlayers).toBe(2);
  });

  it('deals 3 cards to each of the 2 seats and puts them on opposing solo teams', () => {
    const state = truco1v1Definition.setup({
      players: PLAYERS_1V1,
      options: {},
      seed: 1,
    });
    expect(state.seats).toHaveLength(2);
    for (const seat of state.seats) {
      expect(state.zones.get(`hand_${seat.seatIndex}`)?.cards).toHaveLength(3);
    }
    expect(state.seats.map((s) => s.teamId)).toEqual(['A', 'B']);
  });

  it('resolves a trick once both seats (not four) have played', () => {
    const state = baseState1v1();
    let next = truco1v1Definition.moves.play_card!.apply(state, 'p1', {
      cardId: 'w1',
    });
    next = truco1v1Definition.moves.play_card!.apply(next, 'p2', {
      cardId: 'w2',
    });
    expect(next.trickResults).toEqual(['A']);
    expect(next.zones.require('discard').size).toBe(2);
  });

  // Before this variant existed, endHand always rotated the dealer with
  // `% 4` (SEAT_COUNT). On a 2-seat table that sends leadSeat to 2 — a seat
  // that doesn't exist — instead of wrapping back to 0, and the next hand
  // is dealt to a player nobody can ever act as.
  it('rotates the dealer back to seat 0 (not the 4-seat modulo) when seat 1 wins the hand', () => {
    const turn = new TurnOrder(SEATS_1V1);
    turn.currentSeat = 1;
    const state = baseState1v1({
      zones: zonesFor({
        0: [{ id: 'weak', suit: 'copas', rank: '4' }],
        1: [{ id: 'strong', suit: 'paus', rank: '3' }],
      }),
      trickResults: ['B'],
      trickIndex: 1,
      leadSeat: 1,
      turn,
    });
    let next = truco1v1Definition.moves.play_card!.apply(state, 'p2', {
      cardId: 'strong',
    });
    next = truco1v1Definition.moves.play_card!.apply(next, 'p1', {
      cardId: 'weak',
    });
    expect(next.trickResults).toEqual([]); // hand ended, tricks reset for the redeal
    expect(next.matchScore.B).toBe(1);
    expect(next.leadSeat).toBe(0);
  });

  it('forfeits the match to the other player when one abandons it', () => {
    const state = baseState1v1();
    const after = truco1v1Definition.onDisconnectForfeit!(state, 'p2');
    expect(after).not.toBeNull();
    expect(after!.forfeitedTeam).toBe('B');
    expect(truco1v1Definition.isMatchOver(after!)).toBe(true);
    expect(
      truco1v1Definition.scoreboard(after!).find((e) => e.userId === 'p1')
        ?.position,
    ).toBe(1);
  });
});
