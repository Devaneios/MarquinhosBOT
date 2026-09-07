import { describe, expect, it } from 'bun:test';
import {
  ConnectFourSession,
  type ConnectFourSessionIdentity,
} from 'services/activity/connectFour/ConnectFourSession';
import type { ActivityMode } from 'services/activity/gameId';

function identity(mode: ActivityMode = 'multi'): ConnectFourSessionIdentity {
  return {
    sessionKey: `inst-1:connect-four:${mode}`,
    instanceId: 'inst-1',
    guildId: 'guild-1',
    mode,
  };
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fakeBroadcaster() {
  const messages: { key: string; message: unknown }[] = [];
  return {
    broadcast: (key: string, message: unknown) => {
      messages.push({ key, message });
    },
    messages,
  };
}

describe('ConnectFourSession', () => {
  it('assigns p1 to the first joiner and p2 to the second', () => {
    const broadcaster = fakeBroadcaster();
    const session = new ConnectFourSession(identity(), broadcaster);

    expect(session.addPlayer('u1', {})).toBe('p1');
    expect(session.addPlayer('u2', {})).toBe('p2');
    expect(session.playerCount).toBe(2);
  });

  it('rejects a third joiner', () => {
    const broadcaster = fakeBroadcaster();
    const session = new ConnectFourSession(identity(), broadcaster);
    session.addPlayer('u1', {});
    session.addPlayer('u2', {});

    expect(session.addPlayer('u3', {})).toBeNull();
  });

  it('rejects a move from a player not in the session', () => {
    const broadcaster = fakeBroadcaster();
    const session = new ConnectFourSession(identity(), broadcaster);
    session.addPlayer('u1', {});
    session.addPlayer('u2', {});

    expect(session.dropDisc('ghost', 3)).toBe(false);
  });

  it('rejects an out-of-turn move', () => {
    const broadcaster = fakeBroadcaster();
    const session = new ConnectFourSession(identity(), broadcaster);
    session.addPlayer('u1', {});
    session.addPlayer('u2', {});

    expect(session.dropDisc('u2', 3)).toBe(false);
    expect(session.dropDisc('u1', 3)).toBe(true);
  });

  it('broadcasts state after every accepted move', () => {
    const broadcaster = fakeBroadcaster();
    const session = new ConnectFourSession(identity(), broadcaster);
    session.addPlayer('u1', {});
    session.addPlayer('u2', {});

    session.dropDisc('u1', 3);

    const last = broadcaster.messages.at(-1) as {
      message: { type: string; payload: { currentTurn: string } };
    };
    expect(last.message.type).toBe('state');
    expect(last.message.payload.currentTurn).toBe('p2');
  });

  it('forfeits to the remaining player on explicit leave mid-match', () => {
    const broadcaster = fakeBroadcaster();
    const session = new ConnectFourSession(identity(), broadcaster);
    const conn1 = {};
    session.addPlayer('u1', conn1);
    session.addPlayer('u2', {});

    session.leave('u1', conn1);

    const forfeitMsg = broadcaster.messages.find(
      (m) =>
        (m.message as { type: string }).type === 'state' &&
        (m.message as { payload: { winner: string | null } }).payload.winner ===
          'p2',
    );
    expect(forfeitMsg).toBeDefined();
    expect(session.playerCount).toBe(1);
  });

  it('single-player mode makes the bot move after the human', async () => {
    const broadcaster = fakeBroadcaster();
    const session = new ConnectFourSession(
      identity('single'),
      broadcaster,
      undefined,
      {
        botMoveDelayMs: 5,
      },
    );
    const disc = session.addPlayer('u1', {});
    expect(disc).toBe('p1');
    session.enableBot(disc!);

    session.dropDisc('u1', 3);
    await wait(30);

    const state = session.getPublicState();
    const totalDiscs = state.grid.flat().filter((c) => c !== null).length;
    expect(totalDiscs).toBe(2);
  });

  it('pauses (not forfeits) on disconnect in multi mode, forfeits after grace expires', async () => {
    const broadcaster = fakeBroadcaster();
    const session = new ConnectFourSession(
      identity('multi'),
      broadcaster,
      undefined,
      {
        disconnectGraceMs: 20,
      },
    );
    const conn1 = {};
    session.addPlayer('u1', conn1);
    session.addPlayer('u2', {});

    session.pauseForDisconnect('u1', conn1);
    expect(session.playerCount).toBe(2);

    await wait(40);
    expect(session.playerCount).toBe(1);
  });
});

describe('ConnectFourSession.getWinnerUserId', () => {
  it('returns null before a winner exists', () => {
    const broadcaster = fakeBroadcaster();
    const session = new ConnectFourSession(identity(), broadcaster);
    session.addPlayer('user-p1', {});
    session.addPlayer('user-p2', {});
    expect(session.getWinnerUserId()).toBe(null);
  });

  it('resolves the winning disc back to the winning userId', () => {
    const broadcaster = fakeBroadcaster();
    const session = new ConnectFourSession(identity(), broadcaster);
    session.addPlayer('user-p1', {}); // p1
    session.addPlayer('user-p2', {}); // p2

    session.dropDisc('user-p1', 0);
    session.dropDisc('user-p2', 1);
    session.dropDisc('user-p1', 0);
    session.dropDisc('user-p2', 1);
    session.dropDisc('user-p1', 0);
    session.dropDisc('user-p2', 1);
    session.dropDisc('user-p1', 0); // p1 completes a vertical line in col 0

    expect(session.getWinnerUserId()).toBe('user-p1');
  });
});

describe('ConnectFourSession.substitutePlayer', () => {
  it("reseats the incoming player into the outgoing player's exact disc", () => {
    const broadcaster = fakeBroadcaster();
    const session = new ConnectFourSession(identity(), broadcaster);
    session.addPlayer('user-p1', {}); // p1
    session.addPlayer('user-p2', {}); // p2

    const ok = session.substitutePlayer('user-p2', 'user-new', {});
    expect(ok).toBe(true);

    // 'user-new' now owns p2's seat: a move from 'user-p2' is no longer valid...
    session.dropDisc('user-p1', 0);
    const rejected = session.dropDisc('user-p2', 1);
    expect(rejected).toBe(false);
    // ...but the same move from 'user-new' plays as p2.
    const accepted = session.dropDisc('user-new', 1);
    expect(accepted).toBe(true);
  });

  it('returns false when the outgoing userId is not seated', () => {
    const broadcaster = fakeBroadcaster();
    const session = new ConnectFourSession(identity(), broadcaster);
    session.addPlayer('user-p1', {});
    expect(session.substitutePlayer('nobody', 'user-new', {})).toBe(false);
  });
});
