import { describe, expect, it, mock } from 'bun:test';
import { MinesweeperSession } from 'services/activity/minesweeper/MinesweeperSession';
import type { GameResultInput } from 'services/gamification/types';

function fakeBroadcaster() {
  const messages: {
    key: string;
    message: { type: string; payload?: unknown };
  }[] = [];
  return {
    broadcast: (key: string, message: { type: string; payload?: unknown }) => {
      messages.push({ key, message });
    },
    messages,
  };
}

function fakeGamification() {
  return { recordGameResult: mock((_input: GameResultInput) => {}) };
}

describe('MinesweeperSession', () => {
  it('rejects a reveal from a userId that never joined', () => {
    const broadcaster = fakeBroadcaster();
    const session = new MinesweeperSession(
      {
        sessionKey: 'inst-1:minesweeper-versus:multi',
        instanceId: 'inst-1',
        guildId: 'guild-1',
      },
      broadcaster,
      fakeGamification() as never,
    );

    const result = session.reveal('ghost', 0, 0);
    expect(result).toEqual({ error: 'not_in_session' });
    expect(broadcaster.messages.length).toBe(0);
  });

  it('broadcasts a reveal event to the room for a joined player', () => {
    const broadcaster = fakeBroadcaster();
    const session = new MinesweeperSession(
      {
        sessionKey: 'inst-1:minesweeper-versus:multi',
        instanceId: 'inst-1',
        guildId: 'guild-1',
      },
      broadcaster,
      fakeGamification() as never,
      { width: 3, height: 3, mineCount: 0 },
    );
    session.addPlayer('user-a', 'conn-a');

    const result = session.reveal('user-a', 0, 0);
    expect('error' in result).toBe(false);

    expect(broadcaster.messages.length).toBeGreaterThan(0);
    const revealMsg = broadcaster.messages.find(
      (m) => m.message.type === 'reveal',
    );
    expect(revealMsg).toBeDefined();
    const payload = revealMsg!.message.payload as { userId: string };
    expect(payload.userId).toBe('user-a');
  });

  it('never leaks unrevealed mine positions in the board snapshot', () => {
    const broadcaster = fakeBroadcaster();
    const session = new MinesweeperSession(
      {
        sessionKey: 'inst-1:minesweeper-versus:multi',
        instanceId: 'inst-1',
        guildId: 'guild-1',
      },
      broadcaster,
      fakeGamification() as never,
      { width: 6, height: 6, mineCount: 10 },
    );
    session.addPlayer('user-a', 'conn-a');
    session.reveal('user-a', 0, 0);

    const snapshot = session.getBoardSnapshot();
    for (const row of snapshot.grid) {
      for (const cell of row) {
        if (!cell.revealed) expect(cell.mine).toBeUndefined();
      }
    }
  });

  it('records a gamification result ranked by score once the game ends', () => {
    const broadcaster = fakeBroadcaster();
    const gamification = fakeGamification();
    const session = new MinesweeperSession(
      {
        sessionKey: 'inst-1:minesweeper-versus:multi',
        instanceId: 'inst-1',
        guildId: 'guild-1',
      },
      broadcaster,
      gamification as never,
      { width: 3, height: 3, mineCount: 1 },
    );
    session.addPlayer('user-a', 'conn-a');
    session.addPlayer('user-b', 'conn-b');

    // Drive the tiny 3x3/1-mine board to completion: whichever tile isn't
    // the mine will cascade to the win since a single-mine 3x3 board is one
    // connected open region.
    for (
      let y = 0;
      y < 3 && gamification.recordGameResult.mock.calls.length === 0;
      y++
    ) {
      for (
        let x = 0;
        x < 3 && gamification.recordGameResult.mock.calls.length === 0;
        x++
      ) {
        session.reveal('user-a', x, y);
      }
    }

    expect(gamification.recordGameResult.mock.calls.length).toBe(1);
    const input = gamification.recordGameResult.mock.calls[0]![0];
    expect(input.gameType).toBe('minesweeper-versus');
    const userIds = input.results.map((r) => r.userId).sort();
    expect(userIds).toEqual(['user-a', 'user-b']);

    const gameOverMsg = broadcaster.messages.find(
      (m) => m.message.type === 'game_over',
    );
    expect(gameOverMsg).toBeDefined();
  });

  it('does not affect other players when one disconnects', () => {
    const broadcaster = fakeBroadcaster();
    const session = new MinesweeperSession(
      {
        sessionKey: 'inst-1:minesweeper-versus:multi',
        instanceId: 'inst-1',
        guildId: 'guild-1',
      },
      broadcaster,
      fakeGamification() as never,
      { width: 4, height: 4, mineCount: 0 },
    );
    session.addPlayer('user-a', 'conn-a');
    session.addPlayer('user-b', 'conn-b');

    session.removeConnection('user-a', 'conn-a');

    const result = session.reveal('user-b', 0, 0);
    expect('error' in result).toBe(false);
  });

  it('ends the session only once every player has disconnected', async () => {
    const broadcaster = fakeBroadcaster();
    let ended = false;
    const session = new MinesweeperSession(
      {
        sessionKey: 'inst-1:minesweeper-versus:multi',
        instanceId: 'inst-1',
        guildId: 'guild-1',
      },
      broadcaster,
      fakeGamification() as never,
      {},
      {
        onSessionEnded: () => {
          ended = true;
        },
        emptyRoomGraceMs: 0,
      },
    );
    session.addPlayer('user-a', 'conn-a');
    session.addPlayer('user-b', 'conn-b');

    session.removeConnection('user-a', 'conn-a');
    expect(ended).toBe(false);
    session.removeConnection('user-b', 'conn-b');
    expect(ended).toBe(false);
    // The empty-room grace timer defers `onSessionEnded` by a tick (see
    // MinesweeperSession) to absorb React StrictMode's dev-only phantom
    // mount/unmount — flush it here.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(ended).toBe(true);
  });
});
