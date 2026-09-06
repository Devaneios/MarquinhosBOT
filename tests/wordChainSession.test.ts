import { describe, expect, it } from 'bun:test';
import type { ActivityBroadcaster } from 'services/activity/shared/ActivityBroadcaster';
import { WordChainSession } from 'services/activity/word-chain/WordChainSession';

type BroadcastMessage = { type: string; payload?: unknown };

describe('WordChainSession', () => {
  it('initializes with no players', () => {
    const broadcaster: ActivityBroadcaster = {
      broadcast: () => undefined,
    };

    const session = new WordChainSession(
      {
        sessionKey: 'test:word-chain:multi',
        instanceId: 'inst-1',
        guildId: 'guild-1',
        mode: 'multi',
      },
      broadcaster,
    );

    expect(session.playerCount).toBe(0);
    expect(session.state.gameOver).toBe(false);
  });

  it('adds a player to the session', () => {
    const broadcaster: ActivityBroadcaster = {
      broadcast: () => undefined,
    };

    const session = new WordChainSession(
      {
        sessionKey: 'test:word-chain:multi',
        instanceId: 'inst-1',
        guildId: 'guild-1',
        mode: 'multi',
      },
      broadcaster,
    );

    const result = session.addPlayer('user-1', {});
    expect(result).toBe(true);
    expect(session.playerCount).toBe(1);
  });

  it('broadcasts state after player joins', () => {
    const messages: BroadcastMessage[] = [];
    const broadcaster: ActivityBroadcaster = {
      broadcast: (_key, message) => messages.push(message),
    };

    const session = new WordChainSession(
      {
        sessionKey: 'test:word-chain:multi',
        instanceId: 'inst-1',
        guildId: 'guild-1',
        mode: 'multi',
      },
      broadcaster,
    );

    session.addPlayer('user-1', {});

    expect(messages.length).toBeGreaterThan(0);
    const stateMsg = messages.find((m) => m.type === 'state');
    expect(stateMsg).toBeDefined();
  });

  it('handles word submission through engine', () => {
    type WordChainStatePayload = { currentWord: string; currentTurn: string };
    const captured: { state: WordChainStatePayload | null } = { state: null };
    const broadcaster: ActivityBroadcaster = {
      broadcast: (_key, message) => {
        if (message.type === 'state')
          captured.state = message.payload as WordChainStatePayload;
      },
    };

    const session = new WordChainSession(
      {
        sessionKey: 'test:word-chain:multi',
        instanceId: 'inst-1',
        guildId: 'guild-1',
        mode: 'multi',
      },
      broadcaster,
    );

    session.addPlayer('user-1', {});
    session.addPlayer('user-2', {});

    session.handleWordSubmission('user-1', 'abelha');

    expect(captured.state?.currentWord).toBe('abelha');
    expect(captured.state?.currentTurn).toBe('user-2');
  });

  it('returns a rejection result when word submission invalid, without broadcasting it', () => {
    const messages: BroadcastMessage[] = [];
    const broadcaster: ActivityBroadcaster = {
      broadcast: (_key, message) => messages.push(message),
    };

    const session = new WordChainSession(
      {
        sessionKey: 'test:word-chain:multi',
        instanceId: 'inst-1',
        guildId: 'guild-1',
        mode: 'multi',
      },
      broadcaster,
    );

    session.addPlayer('user-1', {});
    session.addPlayer('user-2', {});

    session.handleWordSubmission('user-1', 'abelha');
    const result = session.handleWordSubmission('user-2', 'abelha');

    expect(result.ok).toBe(false);
    expect(result.ok ? undefined : result.error).toBeDefined();
    expect(messages.some((m) => m.type === 'action_rejected')).toBe(false);
  });

  it('does not evict the surviving connection when a superseded socket drops', () => {
    const session = new WordChainSession(
      {
        sessionKey: 'test:word-chain:multi',
        instanceId: 'inst-1',
        guildId: 'guild-1',
        mode: 'multi',
      },
      { broadcast: () => undefined },
    );

    const staleConn = {};
    const liveConn = {};
    session.addPlayer('user-1', staleConn);
    session.addPlayer('user-1', liveConn);
    session.addPlayer('user-2', {});

    session.pauseForDisconnect('user-1', staleConn);

    expect(session.playerCount).toBe(2);
    expect(
      session.state.players.find((p) => p.userId === 'user-1')?.alive,
    ).toBe(true);
  });

  const wait = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  it('detaches outside multi mode after the (short) single-mode grace elapses', async () => {
    const session = new WordChainSession(
      {
        sessionKey: 'test:word-chain:single',
        instanceId: 'inst-1',
        guildId: 'guild-1',
        mode: 'single',
      },
      { broadcast: () => undefined },
      { singleModeDisconnectGraceMs: 0 },
    );

    const conn = {};
    session.addPlayer('user-1', conn);
    session.pauseForDisconnect('user-1', conn);
    await wait(0);

    expect(session.playerCount).toBe(0);
  });

  it('does not start the turn clock for a solo player waiting for an opponent', async () => {
    const session = new WordChainSession(
      {
        sessionKey: 'test:word-chain:multi',
        instanceId: 'inst-1',
        guildId: 'guild-1',
        mode: 'multi',
      },
      { broadcast: () => undefined },
      { turnTimeoutMs: 20 },
    );

    session.addPlayer('user-1', {});
    await wait(60);

    expect(session.playerCount).toBe(1);
    expect(
      session.state.players.find((p) => p.userId === 'user-1')?.alive,
    ).toBe(true);
  });

  it('re-arms the turn clock for the next player after a timeout elimination', async () => {
    const session = new WordChainSession(
      {
        sessionKey: 'test:word-chain:multi',
        instanceId: 'inst-1',
        guildId: 'guild-1',
        mode: 'multi',
      },
      { broadcast: () => undefined },
      { turnTimeoutMs: 20 },
    );

    session.addPlayer('user-1', {});
    session.addPlayer('user-2', {});
    session.addPlayer('user-3', {});

    // user-1 is up first; let their clock lapse without submitting.
    await wait(40);
    expect(
      session.state.players.find((p) => p.userId === 'user-1')?.alive,
    ).toBe(false);

    // If the next player's clock was re-armed, they too get timed out
    // without ever submitting a word.
    await wait(40);
    const alive = session.state.players.filter((p) => p.alive);
    expect(alive.length).toBeLessThan(2);
  });

  it("pauses the turn clock during disconnect grace on the disconnected player's turn", async () => {
    const session = new WordChainSession(
      {
        sessionKey: 'test:word-chain:multi',
        instanceId: 'inst-1',
        guildId: 'guild-1',
        mode: 'multi',
      },
      { broadcast: () => undefined },
      { turnTimeoutMs: 20, disconnectGraceMs: 100 },
    );

    const conn1 = {};
    session.addPlayer('user-1', conn1);
    session.addPlayer('user-2', {});

    // It's user-1's turn; they drop mid-turn.
    session.pauseForDisconnect('user-1', conn1);

    // Long enough for the (paused) turn clock to have fired if it hadn't
    // been paused, but well inside the disconnect grace window.
    await wait(40);
    expect(
      session.state.players.find((p) => p.userId === 'user-1')?.alive,
    ).toBe(true);

    // Reconnecting resumes the same turn instead of forfeiting it.
    session.addPlayer('user-1', conn1);
    expect(session.state.currentTurn).toBe('user-1');
  });

  it('ranks eliminated players by reverse elimination order, not just alive vs. gone', async () => {
    const results: { userId: string; position: number }[] = [];
    const gamification = {
      recordGameResult: (input: {
        results: { userId: string; position: number }[];
      }) => {
        results.push(...input.results);
      },
    };

    const session = new WordChainSession(
      {
        sessionKey: 'test:word-chain:multi',
        instanceId: 'inst-1',
        guildId: 'guild-1',
        mode: 'multi',
      },
      { broadcast: () => undefined },
      { turnTimeoutMs: 20 },
    );
    // @ts-expect-error -- test-only injection of a fake gamification sink
    session['gamification'] = gamification;

    session.addPlayer('user-1', {});
    session.addPlayer('user-2', {});
    session.addPlayer('user-3', {});

    // Let the turn clock eliminate players one at a time until one remains.
    await wait(200);

    expect(results.length).toBe(3);
    const winner = results.find((r) => r.position === 1);
    expect(winner).toBeDefined();
    const others = results.filter((r) => r.position !== 1);
    expect(new Set(others.map((r) => r.position)).size).toBe(others.length);
  });
});
