import { describe, expect, it } from 'bun:test';
import { TicTacToeSession } from 'services/activity/ticTacToe/TicTacToeSession';

function noopBroadcaster() {
  return { broadcast: () => {} };
}

describe('TicTacToeSession.getWinnerUserId', () => {
  it('returns null before a winner exists', () => {
    const session = new TicTacToeSession(
      { sessionKey: 'k', instanceId: 'i', guildId: 'g', mode: 'multi' },
      noopBroadcaster(),
    );
    session.addPlayer('user-x', {});
    session.addPlayer('user-o', {});
    expect(session.getWinnerUserId()).toBe(null);
  });

  it('resolves the winning marker back to the winning userId', () => {
    const session = new TicTacToeSession(
      { sessionKey: 'k', instanceId: 'i', guildId: 'g', mode: 'multi' },
      noopBroadcaster(),
    );
    session.addPlayer('user-x', {}); // X
    session.addPlayer('user-o', {}); // O
    session.handleMove('user-x', 0, 0);
    session.handleMove('user-o', 1, 0);
    session.handleMove('user-x', 0, 1);
    session.handleMove('user-o', 1, 1);
    session.handleMove('user-x', 0, 2); // X completes the top row
    expect(session.getWinnerUserId()).toBe('user-x');
  });
});

describe('TicTacToeSession.substitutePlayer', () => {
  it("reseats the incoming player into the outgoing player's exact marker", () => {
    const session = new TicTacToeSession(
      { sessionKey: 'k', instanceId: 'i', guildId: 'g', mode: 'multi' },
      noopBroadcaster(),
    );
    session.addPlayer('user-x', {}); // X
    session.addPlayer('user-o', {}); // O

    const seat = session.substitutePlayer('user-o', 'user-new', {});
    expect(seat).toBe('O');

    // 'user-new' now owns O's seat: a move from 'user-o' is no longer valid...
    const rejected = session.handleMove('user-o', 1, 1);
    expect(rejected.ok).toBe(false);
    // ...but the same board position from 'user-new' plays as O.
    session.handleMove('user-x', 0, 0);
    const accepted = session.handleMove('user-new', 1, 1);
    expect(accepted.ok).toBe(true);
  });

  it('returns false when the outgoing userId is not seated', () => {
    const session = new TicTacToeSession(
      { sessionKey: 'k', instanceId: 'i', guildId: 'g', mode: 'multi' },
      noopBroadcaster(),
    );
    session.addPlayer('user-x', {});
    expect(session.substitutePlayer('nobody', 'user-new', {})).toBeNull();
  });
});

describe('TicTacToeSession results', () => {
  it('records every match played in the same Activity instance', async () => {
    const { db } = await import('@marquinhos/database/sqlite');
    const { GamificationService } = await import('services/gamification');
    const session = new TicTacToeSession(
      {
        sessionKey: 'k',
        instanceId: 'inst-rematch',
        guildId: 'guild-rematch',
        mode: 'multi',
      },
      noopBroadcaster(),
      new GamificationService(),
    );
    session.addPlayer('rematch-x', {});
    session.addPlayer('rematch-o', {});
    const xWinsTopRow = () => {
      session.handleMove('rematch-x', 0, 0);
      session.handleMove('rematch-o', 1, 0);
      session.handleMove('rematch-x', 0, 1);
      session.handleMove('rematch-o', 1, 1);
      session.handleMove('rematch-x', 0, 2);
    };

    xWinsTopRow();
    session.requestRestart('rematch-x');
    session.requestRestart('rematch-o');
    xWinsTopRow();

    const { matches } = db
      .query<{ matches: number }, [string]>(
        'SELECT COUNT(*) AS matches FROM user_game_results WHERE user_id = ?',
      )
      .get('rematch-x')!;
    expect(matches).toBe(2);
  });

  // Results are often recorded from timers (bot moves, disconnect
  // forfeits), where a throw would take down the whole process.
  it('keeps the match going when recording its result fails', () => {
    const failing = {
      recordGameResult: () => {
        throw new Error('database is locked');
      },
    };
    const session = new TicTacToeSession(
      { sessionKey: 'k', instanceId: 'i', guildId: 'g', mode: 'multi' },
      noopBroadcaster(),
      failing as never,
    );
    session.addPlayer('user-x', {});
    session.addPlayer('user-o', {});
    session.handleMove('user-x', 0, 0);
    session.handleMove('user-o', 1, 0);
    session.handleMove('user-x', 0, 1);
    session.handleMove('user-o', 1, 1);

    expect(() => session.handleMove('user-x', 0, 2)).not.toThrow();
    expect(session.getWinnerUserId()).toBe('user-x');
  });
});
