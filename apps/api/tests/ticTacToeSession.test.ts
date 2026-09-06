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

    const ok = session.substitutePlayer('user-o', 'user-new', {});
    expect(ok).toBe(true);

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
    expect(session.substitutePlayer('nobody', 'user-new', {})).toBe(false);
  });
});
