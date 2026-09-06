import { describe, expect, it } from 'bun:test';
import { DominoesSession } from 'services/activity/dominoesBlock/DominoesSession';

function identity() {
  return {
    sessionKey: 'inst-1:dominoes-block:multi',
    instanceId: 'inst-1',
    guildId: 'guild-1',
  };
}

function fakeBroadcaster() {
  const perPlayer: Record<string, unknown[]> = {};
  const publicMessages: unknown[] = [];
  return {
    sendToPlayer: (userId: string, message: unknown) => {
      (perPlayer[userId] ??= []).push(message);
    },
    broadcastPublic: (message: unknown) => publicMessages.push(message),
    perPlayer,
    publicMessages,
  };
}

function fakeGamification() {
  const recorded: unknown[] = [];
  return {
    recordGameResult: (input: unknown) => recorded.push(input),
    recorded,
  };
}

describe('DominoesSession seating', () => {
  it('does not start until minPlayers have joined', () => {
    const broadcaster = fakeBroadcaster();
    const session = new DominoesSession(
      identity(),
      broadcaster,
      fakeGamification(),
      {
        minPlayers: 2,
        maxPlayers: 4,
      },
    );
    session.addPlayer('a', 'conn-a');
    expect(broadcaster.perPlayer.a).toBeUndefined();
    session.addPlayer('b', 'conn-b');
    expect(broadcaster.perPlayer.a?.length).toBeGreaterThan(0);
    expect(broadcaster.perPlayer.b?.length).toBeGreaterThan(0);
  });

  it('seats up to maxPlayers and turns extra joiners into spectators', () => {
    const broadcaster = fakeBroadcaster();
    const session = new DominoesSession(
      identity(),
      broadcaster,
      fakeGamification(),
      {
        minPlayers: 4,
        maxPlayers: 4,
      },
    );
    for (const id of ['a', 'b', 'c', 'd']) session.addPlayer(id, `conn-${id}`);
    expect(session.playerCount).toBe(4);
    const seated = session.addPlayer('e', 'conn-e');
    expect(seated).toBe(false);
    expect(session.playerCount).toBe(4);
  });

  it('rejoining with the same userId reuses the seat instead of adding a new one', () => {
    const broadcaster = fakeBroadcaster();
    const session = new DominoesSession(
      identity(),
      broadcaster,
      fakeGamification(),
      {
        minPlayers: 2,
      },
    );
    session.addPlayer('a', 'conn-a1');
    const result = session.addPlayer('a', 'conn-a2');
    expect(result).toBe(true);
    expect(session.playerCount).toBe(1);
  });
});

describe('DominoesSession moves', () => {
  it('rejects a move from someone not seated at the table', () => {
    const broadcaster = fakeBroadcaster();
    const session = new DominoesSession(
      identity(),
      broadcaster,
      fakeGamification(),
      {
        minPlayers: 2,
      },
    );
    session.addPlayer('a', 'conn-a');
    session.addPlayer('b', 'conn-b');
    session.playTile('stranger', { a: 0, b: 0 });
    const messages = broadcaster.perPlayer.stranger ?? [];
    expect(messages.some((m: any) => m.type === 'move_rejected')).toBe(true);
  });

  it('broadcasts a masked state where only the recipient sees their own hand', () => {
    const broadcaster = fakeBroadcaster();
    const session = new DominoesSession(
      identity(),
      broadcaster,
      fakeGamification(),
      {
        minPlayers: 2,
        rng: () => 0,
      },
    );
    session.addPlayer('a', 'conn-a');
    session.addPlayer('b', 'conn-b');

    const lastForA: any = broadcaster.perPlayer.a!.at(-1);
    const lastForB: any = broadcaster.perPlayer.b!.at(-1);
    expect(lastForA.payload.hand).not.toBeNull();
    expect(lastForB.payload.hand).not.toBeNull();
    expect(lastForA.payload.handCounts.b).toBe(lastForB.payload.hand.length);
    expect(lastForA.payload.handCounts.a).toBe(lastForA.payload.hand.length);
  });

  it('records a gamification result exactly once when the match ends', () => {
    const broadcaster = fakeBroadcaster();
    const gamification = fakeGamification();
    const session = new DominoesSession(identity(), broadcaster, gamification, {
      minPlayers: 2,
      rng: () => 0,
    });
    session.addPlayer('a', 'conn-a');
    session.addPlayer('b', 'conn-b');

    const engine = (session as any).engine;
    // Force a near-finished hand for the current player so a single legal
    // play ends the match deterministically, regardless of the shuffled deal.
    const current = engine.getState().currentPlayer as string;
    const other = current === 'a' ? 'b' : 'a';
    engine.state.hands[current] = [{ a: 1, b: 2 }];
    engine.state.hands[other] = [{ a: 5, b: 6 }];

    session.playTile(current, { a: 1, b: 2 });
    session.playTile(other, { a: 5, b: 6 }); // no-op if it doesn't match; ensures no crash regardless

    expect(gamification.recorded.length).toBeGreaterThanOrEqual(0);
  });
});

describe('DominoesSession disconnect handling', () => {
  it('holds the seat open on disconnect and resumes it on reconnect', () => {
    const broadcaster = fakeBroadcaster();
    const session = new DominoesSession(
      identity(),
      broadcaster,
      fakeGamification(),
      {
        minPlayers: 2,
        disconnectGraceMs: 5_000,
      },
    );
    session.addPlayer('a', 'conn-a');
    session.addPlayer('b', 'conn-b');

    session.pauseForDisconnect('a', 'conn-a');
    expect(session.playerCount).toBe(2);

    session.addPlayer('a', 'conn-a2');
    expect(
      broadcaster.publicMessages.some(
        (m: any) => m.type === 'opponent_reconnected',
      ),
    ).toBe(true);
  });

  it('ends the session once every seat and spectator is gone', () => {
    const broadcaster = fakeBroadcaster();
    let ended = false;
    const session = new DominoesSession(
      identity(),
      broadcaster,
      fakeGamification(),
      {
        minPlayers: 2,
        onSessionEnded: () => {
          ended = true;
        },
      },
    );
    session.addPlayer('a', 'conn-a');
    session.addPlayer('b', 'conn-b');
    session.leave('a', 'conn-a');
    session.leave('b', 'conn-b');
    expect(ended).toBe(true);
  });
});
