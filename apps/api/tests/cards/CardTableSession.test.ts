import { describe, expect, it, mock } from 'bun:test';
import { CardTableSession } from 'services/activity/cards/CardTableSession';
import {
  MOVE_OK,
  moveRejected,
  type GameDefinition,
} from 'services/activity/cards/core/GameDefinition';
import type { PerClientBroadcaster } from 'services/activity/cards/PerClientBroadcaster';

interface StubState {
  players: string[];
  total: number;
  winner: string | null;
  forfeitedBy: string | null;
}

interface AddArgs {
  amount: number;
}

// A deliberately minimal ruleset: the session has to drive seating, gating,
// forfeits and the turn clock without knowing anything about the game.
function stubDefinition(
  overrides: Partial<GameDefinition<StubState>> = {},
): GameDefinition<StubState> {
  return {
    id: 'stub-game',
    minPlayers: 2,
    maxPlayers: 2,
    setup: ({ players }) => ({
      players: players.map((p) => p.userId),
      total: 0,
      winner: null,
      forfeitedBy: null,
    }),
    moves: {
      add: {
        parseArgs: (raw): AddArgs | null => {
          const amount = (raw as { amount?: unknown } | undefined)?.amount;
          return typeof amount === 'number' ? { amount } : null;
        },
        validate: (_state, _playerId, args) =>
          args.amount <= 0 ? moveRejected('amount must be positive') : MOVE_OK,
        apply: (state, playerId, args) => {
          const total = state.total + args.amount;
          return { ...state, total, winner: total >= 10 ? playerId : null };
        },
      },
    },
    legalMoves: () => [{ move: 'add', args: { amount: 1 } }],
    isRoundOver: (state) => state.total > 0 && state.total % 5 === 0,
    isMatchOver: (state) => state.winner !== null || state.forfeitedBy !== null,
    scoreboard: (state) =>
      state.players.map((userId) => ({
        userId,
        position: userId === state.forfeitedBy ? 2 : 1,
      })),
    maskStateFor: (state, playerId) => ({ ...state, viewer: playerId }),
    ...overrides,
  };
}

function fakeBroadcaster() {
  const perPlayer: Record<string, { type: string; payload?: unknown }[]> = {};
  const known = new Set<string>();
  const broadcaster: PerClientBroadcaster = {
    sendToPlayer: (userId, message) => {
      known.add(userId);
      (perPlayer[userId] ??= []).push(message);
    },
    broadcastPublic: (message) => {
      for (const userId of known) (perPlayer[userId] ??= []).push(message);
    },
  };
  return { broadcaster, perPlayer };
}

const identity = () => ({
  sessionKey: 'key-1',
  instanceId: 'inst-1',
  guildId: 'guild-1',
});

function newSession(
  definition: GameDefinition<StubState> = stubDefinition(),
  options: Record<string, unknown> = {},
) {
  const { broadcaster, perPlayer } = fakeBroadcaster();
  const recordGameResult = mock();
  const session = new CardTableSession(
    identity(),
    broadcaster,
    definition,
    { recordGameResult },
    { seed: 42, ...options },
  );
  return { session, perPlayer, recordGameResult };
}

function typesFor(
  perPlayer: Record<string, { type: string }[]>,
  userId: string,
): string[] {
  return (perPlayer[userId] ?? []).map((m) => m.type);
}

describe('CardTableSession.seatIndexFor', () => {
  it('predicts the seat a new joiner will get, before they join', () => {
    const { session } = newSession();
    expect(session.seatIndexFor('p1')).toBe(0);
    session.addPlayer('p1', {});
    expect(session.seatIndexFor('p2')).toBe(1);
  });

  it('returns the existing seat for an already-joined player', () => {
    const { session } = newSession();
    session.addPlayer('p1', {});
    expect(session.seatIndexFor('p1')).toBe(0);
  });

  it('returns null once the table is full', () => {
    const { session } = newSession();
    session.addPlayer('p1', {});
    session.addPlayer('p2', {});
    expect(session.seatIndexFor('p3')).toBeNull();
  });
});

describe('CardTableSession seat allocation', () => {
  it('fills the lowest free seat rather than counting players', () => {
    // Seat identity from `players.length` collides: with seats 0 and 1 filled,
    // freeing seat 0 leaves length 1, so the next joiner is handed seat 1 — on
    // top of the player already sitting there.
    const definition = stubDefinition({
      minPlayers: 4,
      maxPlayers: 4,
      isMatchOver: () => false,
    });
    const { session } = newSession(definition);
    const c1 = {};
    session.addPlayer('p1', c1);
    session.addPlayer('p2', {});
    session.leave('p1', c1);

    expect(session.addPlayer('p3', {})).toBe(0);
  });

  it('never hands a joiner a seat another player already holds', () => {
    const definition = stubDefinition({
      minPlayers: 4,
      maxPlayers: 4,
      isMatchOver: () => false,
    });
    const { session } = newSession(definition);
    const c2 = {};
    session.addPlayer('p1', {});
    session.addPlayer('p2', c2);
    session.addPlayer('p3', {});
    session.leave('p2', c2); // frees seat 1, leaving seats 0 and 2 occupied

    const seat = session.addPlayer('p4', {});
    expect(seat).toBe(1);
    expect(seat).not.toBe(2);
  });
});

describe('CardTableSession spectators', () => {
  it('seats a latecomer as a spectator instead of handing them a phantom seat', () => {
    // A joiner the running match has never heard of would have no cards and no
    // legal moves forever, while occupying a seat the ruleset cannot see.
    const { session, perPlayer } = newSession();
    session.addPlayer('p1', {});
    session.addPlayer('p2', {});

    expect(session.addPlayer('p3', {})).toBeNull();
    expect(session.playerCount).toBe(2);
    expect(session.spectatorCount).toBe(1);
    expect(typesFor(perPlayer, 'p3')).toContain('state');
  });

  it('masks a spectator as a viewer with no seat', () => {
    const { session, perPlayer } = newSession();
    session.addPlayer('p1', {});
    session.addPlayer('p2', {});
    session.addPlayer('p3', {});
    const view = perPlayer.p3?.at(-1)?.payload as { viewer: string | null };
    expect(view.viewer).toBeNull();
  });

  it('rejects a move from a spectator', () => {
    const { session, perPlayer } = newSession();
    session.addPlayer('p1', {});
    session.addPlayer('p2', {});
    session.addPlayer('p3', {});

    session.handleMove('p3', 'add', { amount: 1 });

    expect(perPlayer.p3?.at(-1)?.type).toBe('move_rejected');
    expect(perPlayer.p1?.at(-1)?.payload).toMatchObject({ total: 0 });
  });
});

describe('CardTableSession moves', () => {
  it('starts the game once enough players have joined', () => {
    const { session, perPlayer } = newSession();
    session.addPlayer('p1', {});
    expect(perPlayer.p1).toBeUndefined(); // not started yet, only 1/2 players

    session.addPlayer('p2', {});
    expect(perPlayer.p1?.[0]?.payload).toMatchObject({
      total: 0,
      viewer: 'p1',
    });
    expect(perPlayer.p2?.[0]?.payload).toMatchObject({ viewer: 'p2' });
  });

  it('rejects an invalid move and only notifies the sender', () => {
    const { session, perPlayer } = newSession();
    session.addPlayer('p1', {});
    session.addPlayer('p2', {});

    session.handleMove('p1', 'add', { amount: -1 });

    expect(perPlayer.p1?.at(-1)?.type).toBe('move_rejected');
    expect(perPlayer.p2?.at(-1)?.type).not.toBe('move_rejected');
  });

  it('rejects a payload that does not parse, before any rule logic runs', () => {
    const { session, perPlayer } = newSession();
    session.addPlayer('p1', {});
    session.addPlayer('p2', {});

    session.handleMove('p1', 'add', { amount: 'lots' });
    expect(perPlayer.p1?.at(-1)?.type).toBe('move_rejected');
  });

  it('applies a valid move and broadcasts the new masked state to every player', () => {
    const { session, perPlayer } = newSession();
    session.addPlayer('p1', {});
    session.addPlayer('p2', {});

    session.handleMove('p1', 'add', { amount: 4 });

    expect(perPlayer.p1?.at(-1)?.payload).toMatchObject({
      total: 4,
      viewer: 'p1',
    });
    expect(perPlayer.p2?.at(-1)?.payload).toMatchObject({ total: 4 });
  });

  it('announces a round boundary once, not again on the next move', () => {
    const { session, perPlayer } = newSession();
    session.addPlayer('p1', {});
    session.addPlayer('p2', {});

    session.handleMove('p1', 'add', { amount: 5 }); // total 5 → round over
    expect(
      typesFor(perPlayer, 'p1').filter((t) => t === 'round_over'),
    ).toHaveLength(1);

    session.handleMove('p1', 'add', { amount: 1 }); // total 6 → no longer
    expect(
      typesFor(perPlayer, 'p1').filter((t) => t === 'round_over'),
    ).toHaveLength(1);
  });
});

describe('CardTableSession match end', () => {
  it('records the gamification result exactly once', () => {
    const { session, recordGameResult } = newSession();
    session.addPlayer('p1', {});
    session.addPlayer('p2', {});

    session.handleMove('p1', 'add', { amount: 10 });
    session.handleMove('p1', 'add', { amount: 1 });

    expect(recordGameResult).toHaveBeenCalledTimes(1);
    expect(recordGameResult).toHaveBeenCalledWith({
      sessionId: 'inst-1',
      guildId: 'guild-1',
      gameType: 'stub-game',
      results: [
        { userId: 'p1', position: 1 },
        { userId: 'p2', position: 1 },
      ],
    });
  });

  it('refuses moves on a finished match instead of rewriting its final state', () => {
    // The gate belongs to the engine. A ruleset that forgets to re-check
    // isMatchOver in one of its move handlers would otherwise keep accepting
    // moves and inflating the score of a match that is already over.
    const { session, perPlayer } = newSession();
    session.addPlayer('p1', {});
    session.addPlayer('p2', {});

    session.handleMove('p1', 'add', { amount: 10 });
    const statesBefore = (perPlayer.p1 ?? []).filter((m) => m.type === 'state');
    const finalState = statesBefore.at(-1)?.payload;
    expect(finalState).toMatchObject({ total: 10 });

    session.handleMove('p1', 'add', { amount: 5 });

    expect(perPlayer.p1?.at(-1)?.type).toBe('move_rejected');
    const statesAfter = (perPlayer.p1 ?? []).filter((m) => m.type === 'state');
    expect(statesAfter).toHaveLength(statesBefore.length); // no new state at all
    expect(statesAfter.at(-1)?.payload).toEqual(finalState);
  });

  it('announces match_over with the scoreboard', () => {
    const { session, perPlayer } = newSession();
    session.addPlayer('p1', {});
    session.addPlayer('p2', {});
    session.handleMove('p1', 'add', { amount: 10 });
    expect(typesFor(perPlayer, 'p1')).toContain('match_over');
  });

  it('only counts connected players toward a restart vote', () => {
    // One player closing their tab on the results screen must not make a
    // rematch impossible for everyone else.
    const { session, perPlayer } = newSession();
    const c1 = {};
    const c2 = {};
    session.addPlayer('p1', c1);
    session.addPlayer('p2', c2);
    session.handleMove('p1', 'add', { amount: 10 });

    session.pauseForDisconnect('p2', c2); // match over → seat freed immediately
    session.requestRestart('p1');

    const states = (perPlayer.p1 ?? []).filter((m) => m.type === 'state');
    expect(states.at(-1)?.payload).toMatchObject({ total: 0 });
  });
});

describe('CardTableSession disconnects', () => {
  it('holds the seat open and warns the table on a network drop', () => {
    const { session, perPlayer } = newSession();
    const c1 = {};
    session.addPlayer('p1', c1);
    session.addPlayer('p2', {});

    session.pauseForDisconnect('p1', c1);

    expect(session.playerCount).toBe(2); // seat held, not freed
    expect(typesFor(perPlayer, 'p2')).toContain('opponent_disconnected');
  });

  it('keeps the seat while any other socket for that user is still open', () => {
    // A React remount opens a second socket before the first finishes closing.
    const { session, perPlayer } = newSession();
    const tabA = {};
    const tabB = {};
    session.addPlayer('p1', tabA);
    session.addPlayer('p1', tabB);
    session.addPlayer('p2', {});

    session.pauseForDisconnect('p1', tabA);

    expect(typesFor(perPlayer, 'p2')).not.toContain('opponent_disconnected');
    expect(session.playerCount).toBe(2);
  });

  it('resumes the same match when the player reconnects within the grace period', () => {
    const { session, perPlayer } = newSession();
    const c1 = {};
    session.addPlayer('p1', c1);
    session.addPlayer('p2', {});
    session.handleMove('p1', 'add', { amount: 3 });

    session.pauseForDisconnect('p1', c1);
    session.addPlayer('p1', {});

    expect(typesFor(perPlayer, 'p2')).toContain('opponent_reconnected');
    expect(perPlayer.p1?.at(-1)?.payload).toMatchObject({ total: 3 });
  });

  it('forfeits through the ruleset when the grace period lapses', async () => {
    const definition = stubDefinition({
      onDisconnectForfeit: (state, userId) => ({
        ...state,
        forfeitedBy: userId,
      }),
    });
    const { session, perPlayer, recordGameResult } = newSession(definition, {
      disconnectGraceMs: 5,
    });
    const c1 = {};
    session.addPlayer('p1', c1);
    session.addPlayer('p2', {});

    session.pauseForDisconnect('p1', c1);
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(recordGameResult).toHaveBeenCalledTimes(1);
    expect(recordGameResult.mock.calls[0]?.[0]?.results).toEqual([
      { userId: 'p1', position: 2 },
      { userId: 'p2', position: 1 },
    ]);
    expect(typesFor(perPlayer, 'p2')).toContain('match_over');
  });

  it('leaves the match running when the ruleset declines to forfeit', async () => {
    // Documented behaviour rather than a silent stall: the session logs it, and
    // the remaining players keep their state.
    const { session } = newSession(stubDefinition(), { disconnectGraceMs: 5 });
    const c1 = {};
    session.addPlayer('p1', c1);
    session.addPlayer('p2', {});

    session.pauseForDisconnect('p1', c1);
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(session.playerCount).toBe(1);
  });

  it('frees the seat immediately on an explicit leave', () => {
    const { session } = newSession(
      stubDefinition({
        onDisconnectForfeit: (state, userId) => ({
          ...state,
          forfeitedBy: userId,
        }),
      }),
    );
    const c1 = {};
    session.addPlayer('p1', c1);
    session.addPlayer('p2', {});

    session.leave('p1', c1);
    expect(session.playerCount).toBe(1);
  });

  it('ends the session once the last player and spectator are gone', () => {
    const onSessionEnded = mock();
    const { broadcaster } = fakeBroadcaster();
    const session = new CardTableSession(
      identity(),
      broadcaster,
      stubDefinition(),
      { recordGameResult: mock() },
      { onSessionEnded, seed: 1 },
    );
    const c1 = {};
    const c2 = {};
    session.addPlayer('p1', c1);
    session.addPlayer('p2', c2);

    session.leave('p1', c1);
    expect(onSessionEnded).not.toHaveBeenCalled();
    session.leave('p2', c2);
    expect(onSessionEnded).toHaveBeenCalled();
  });

  it('keeps the session alive for a spectator after every player leaves', () => {
    const onSessionEnded = mock();
    const { broadcaster } = fakeBroadcaster();
    const session = new CardTableSession(
      identity(),
      broadcaster,
      stubDefinition(),
      { recordGameResult: mock() },
      { onSessionEnded, seed: 1 },
    );
    const c1 = {};
    const c2 = {};
    const watcher = {};
    session.addPlayer('p1', c1);
    session.addPlayer('p2', c2);
    session.addPlayer('p3', watcher);

    session.leave('p1', c1);
    session.leave('p2', c2);
    expect(onSessionEnded).not.toHaveBeenCalled();

    session.leave('p3', watcher);
    expect(onSessionEnded).toHaveBeenCalled();
  });
});

describe('CardTableSession turn clock', () => {
  it('acts for a player who never moves, so an idle seat cannot stall the table', async () => {
    const definition = stubDefinition({
      turnTimeoutMs: 5,
      playersToAct: (state) => (state.winner ? [] : [state.players[0]!]),
      // Auto-plays the move the idle player wouldn't, ending the match — so
      // exactly one timeout can fire and the assertion is deterministic.
      onTurnTimeout: (state) => ({ ...state, total: 10, winner: 'p2' }),
    });
    const { session, perPlayer } = newSession(definition);
    session.addPlayer('p1', {});
    session.addPlayer('p2', {});

    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(typesFor(perPlayer, 'p2')).toContain('turn_timeout');
    const states = (perPlayer.p1 ?? []).filter((m) => m.type === 'state');
    expect(states.at(-1)?.payload).toMatchObject({ total: 10, winner: 'p2' });
  });

  it('re-arms the clock for each new turn, then stops once the match ends', async () => {
    const definition = stubDefinition({
      turnTimeoutMs: 5,
      playersToAct: (state) =>
        state.winner ? [] : [state.players[state.total % 2]!],
      onTurnTimeout: (state) => ({
        ...state,
        total: state.total + 1,
        winner: state.total >= 2 ? 'p1' : null,
      }),
    });
    const { session, perPlayer } = newSession(definition);
    session.addPlayer('p1', {});
    session.addPlayer('p2', {});

    await new Promise((resolve) => setTimeout(resolve, 60));

    // Three timeouts fire and then it stops — a finished match must not keep a
    // timer alive.
    const timeouts = typesFor(perPlayer, 'p1').filter(
      (t) => t === 'turn_timeout',
    );
    expect(timeouts).toHaveLength(3);
  });

  it('does not arm a clock for a ruleset that declares no timeout', async () => {
    const { session, perPlayer } = newSession();
    session.addPlayer('p1', {});
    session.addPlayer('p2', {});

    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(typesFor(perPlayer, 'p1')).not.toContain('turn_timeout');
  });
});
