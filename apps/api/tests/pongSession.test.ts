import { describe, expect, it } from 'bun:test';
import type { ActivityMode } from 'services/activity/gameId';
import {
  PongSession,
  type PongSessionIdentity,
} from 'services/activity/pong/PongSession';
import { decodeStateSnapshot } from 'services/activity/pong/pongProtocol';
import type { GamificationService } from 'services/gamification';

function identity(mode: ActivityMode = 'multi'): PongSessionIdentity {
  return {
    sessionKey: `inst-1:room-1:pong:${mode}`,
    instanceId: 'inst-1',
    guildId: 'guild-1',
    mode,
  };
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fakeBroadcaster() {
  const messages: {
    key: string;
    message: { type: string; payload?: unknown };
  }[] = [];
  const snapshots: ReturnType<typeof decodeStateSnapshot>[] = [];
  return {
    broadcast: (key: string, message: { type: string; payload?: unknown }) =>
      messages.push({ key, message }),
    broadcastBinary: (_key: string, data: ArrayBuffer) =>
      snapshots.push(decodeStateSnapshot(data)),
    messages,
    snapshots,
  };
}

function startClassic(session: PongSession): void {
  session.addPlayer('user-a', 'conn-a');
  session.addPlayer('user-b', 'conn-b');
  session.setReady('user-a', true);
  session.setReady('user-b', true);
}

describe('PongSession', () => {
  it('assigns classic slots and admits overflow as spectators', () => {
    const broadcaster = fakeBroadcaster();
    const session = new PongSession(identity(), broadcaster);

    expect(session.addPlayer('user-a', 'conn-a')).toBe('left');
    expect(session.addPlayer('user-b', 'conn-b')).toBe('right');
    expect(session.addPlayer('user-c', 'conn-c')).toBeNull();
    expect(session.getLobbyState().spectators).toEqual(['user-c']);
  });

  it('restores the same assignment when a player reconnects', () => {
    const broadcaster = fakeBroadcaster();
    const session = new PongSession(identity(), broadcaster);
    session.addPlayer('user-a', 'conn-a');

    session.pauseForDisconnect('user-a', 'conn-a');

    expect(session.addPlayer('user-a', 'conn-b')).toBe('left');
    expect(session.getAssignment('user-a')).toEqual({
      slot: 0,
      side: 'left',
      team: 0,
    });
  });

  it('starts a multi match only after every required player is ready', () => {
    const broadcaster = fakeBroadcaster();
    const session = new PongSession(identity(), broadcaster);
    session.addPlayer('user-a', 'conn-a');
    session.addPlayer('user-b', 'conn-b');

    session.setReady('user-a', true);
    expect(session.getLobbyState().started).toBe(false);
    session.setReady('user-b', true);
    expect(session.getLobbyState().started).toBe(true);
    session.dispose();
  });

  it('preserves players and remaps slots when the host changes ruleset', () => {
    const broadcaster = fakeBroadcaster();
    const session = new PongSession(identity(), broadcaster);
    session.addPlayer('user-a', 'conn-a');
    session.addPlayer('user-b', 'conn-b');

    session.configure('user-a', { ruleset: 'doubles-2v2', bestOf: 3 });

    const lobby = session.getLobbyState();
    expect(lobby.config.ruleset).toBe('doubles-2v2');
    expect(lobby.config.bestOf).toBe(3);
    expect(lobby.players.map((player) => player.userId)).toEqual([
      'user-a',
      'user-b',
    ]);
    expect(lobby.players.every((player) => !player.ready)).toBe(true);
  });

  it('rejects lobby configuration changes from non-host players', () => {
    const broadcaster = fakeBroadcaster();
    const session = new PongSession(identity(), broadcaster);
    session.addPlayer('user-a', 'conn-a');
    session.addPlayer('user-b', 'conn-b');

    session.configure('user-b', { ruleset: 'quad-elimination' });

    expect(session.getLobbyState().config.ruleset).toBe('classic-1v1');
  });

  it('supports four distinct assignments in Quadrapong', () => {
    const broadcaster = fakeBroadcaster();
    const session = new PongSession(identity(), broadcaster, undefined, {
      ruleset: 'quad-elimination',
    });

    expect(['a', 'b', 'c', 'd'].map((id) => session.addPlayer(id, id))).toEqual(
      ['left', 'right', 'top', 'bottom'],
    );
  });

  it('routes sequence-numbered input and acknowledges it in snapshots', () => {
    const broadcaster = fakeBroadcaster();
    const session = new PongSession(identity(), broadcaster);
    startClassic(session);

    session.handleInput('user-a', -1, 1);
    session.tick();

    const snapshot = broadcaster.snapshots.at(-1)!;
    expect(snapshot.acks[0]).toBe(1);
    expect(
      snapshot.paddles.find((paddle) => paddle.slot === 0)!.y,
    ).toBeLessThan(200);
    session.dispose();
  });

  it('ignores stale input sequence numbers', () => {
    const broadcaster = fakeBroadcaster();
    const session = new PongSession(identity(), broadcaster);
    startClassic(session);

    session.handleInput('user-a', -1, 2);
    session.handleInput('user-a', 1, 1);
    session.tick();

    expect(broadcaster.snapshots.at(-1)!.acks[0]).toBe(2);
    expect(
      broadcaster.snapshots.at(-1)!.paddles.find((paddle) => paddle.slot === 0)!
        .y,
    ).toBeLessThan(200);
    session.dispose();
  });

  it('lets local hot-seat input address both sides independently', () => {
    const broadcaster = fakeBroadcaster();
    const session = new PongSession(identity('local'), broadcaster);
    session.addPlayer('user-a', 'conn-a');
    session.enableLocalTwoPlayer();
    session.start();

    session.handleInput('user-a', -1, 1, 'left');
    session.handleInput('user-a', 1, 1, 'right');
    session.tick();

    const paddles = broadcaster.snapshots.at(-1)!.paddles;
    expect(paddles.find((paddle) => paddle.side === 'left')!.y).toBeLessThan(
      200,
    );
    expect(
      paddles.find((paddle) => paddle.side === 'right')!.y,
    ).toBeGreaterThan(200);
    session.dispose();
  });

  it('starts supported solo rulesets with a bot slot', () => {
    const broadcaster = fakeBroadcaster();
    const session = new PongSession(identity('single'), broadcaster);
    session.addPlayer('user-a', 'conn-a');
    session.enableBot('left', 'hard');
    session.start();
    session.tick();

    expect(session.getLobbyState().started).toBe(true);
    expect(broadcaster.snapshots).toHaveLength(1);
    session.dispose();
  });

  it('broadcasts protocol v2 snapshots into the supplied room key', () => {
    const broadcaster = fakeBroadcaster();
    const session = new PongSession(identity(), broadcaster);
    session.tick();

    expect(broadcaster.snapshots[0]!.ruleset).toBe('classic-1v1');
  });

  it('pauses a live multi match during the reconnect grace window', () => {
    const broadcaster = fakeBroadcaster();
    const session = new PongSession(identity(), broadcaster);
    startClassic(session);

    session.pauseForDisconnect('user-a', 'conn-a');

    expect(
      broadcaster.messages.some(
        ({ message }) => message.type === 'player_disconnected',
      ),
    ).toBe(true);
    expect(
      session
        .getLobbyState()
        .players.find((player) => player.userId === 'user-a')?.connected,
    ).toBe(false);
    session.dispose();
  });

  it('cancels a pending forfeit when the same user reconnects', async () => {
    const broadcaster = fakeBroadcaster();
    const session = new PongSession(
      identity(),
      broadcaster,
      undefined,
      {},
      { disconnectGraceMs: 10 },
    );
    startClassic(session);
    session.pauseForDisconnect('user-a', 'conn-a');
    session.addPlayer('user-a', 'conn-b');

    await wait(20);

    expect(session.getLobbyState().players).toHaveLength(2);
    expect(
      broadcaster.messages.some(
        ({ message }) => message.type === 'player_reconnected',
      ),
    ).toBe(true);
    session.dispose();
  });

  it('records an authoritative result once on explicit forfeit', () => {
    const broadcaster = fakeBroadcaster();
    const recorded: unknown[] = [];
    const gamification = {
      recordGameResult: (result: unknown) => recorded.push(result),
    } as unknown as GamificationService;
    const session = new PongSession(identity(), broadcaster, gamification);
    startClassic(session);

    session.leave('user-b', 'conn-b');
    session.leave('user-b', 'conn-b');

    expect(recorded).toEqual([
      {
        sessionId: 'inst-1',
        guildId: 'guild-1',
        gameType: 'pong',
        results: [
          { userId: 'user-a', position: 1 },
          { userId: 'user-b', position: 2 },
        ],
      },
    ]);
    session.dispose();
  });

  it('does not record local matches', () => {
    const broadcaster = fakeBroadcaster();
    const recorded: unknown[] = [];
    const gamification = {
      recordGameResult: (result: unknown) => recorded.push(result),
    } as unknown as GamificationService;
    const session = new PongSession(
      identity('local'),
      broadcaster,
      gamification,
    );
    session.addPlayer('user-a', 'conn-a');
    session.enableLocalTwoPlayer();
    session.start();
    session.leave('user-a', 'conn-a');

    expect(recorded).toEqual([]);
    session.dispose();
  });
});
