import { describe, expect, it } from 'bun:test';
import type { Piece } from 'services/activity/checkers/CheckersEngine';
import {
  CheckersSession,
  type CheckersSessionIdentity,
} from 'services/activity/checkers/CheckersSession';
import type { ActivityMode } from 'services/activity/gameId';

function identity(mode: ActivityMode = 'multi'): CheckersSessionIdentity {
  return {
    sessionKey: `inst-1:checkers:${mode}`,
    instanceId: 'inst-1',
    guildId: 'guild-1',
    mode,
  };
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

function emptyBoard() {
  return Array.from({ length: 8 }, () => Array<Piece | null>(8).fill(null));
}

describe('CheckersSession.getWinnerUserId', () => {
  it('returns null before a winner exists', () => {
    const session = new CheckersSession(identity(), fakeBroadcaster());
    session.addPlayer('user-black', {});
    session.addPlayer('user-red', {});
    expect(session.getWinnerUserId()).toBe(null);
  });

  it('resolves the winning color back to the winning userId', () => {
    const session = new CheckersSession(identity(), fakeBroadcaster());
    session.addPlayer('user-black', {}); // black
    session.addPlayer('user-red', {}); // red

    // Force a position where black's only capture clears red's last piece,
    // the same setup as CheckersEngine's "opponent has no pieces left" test,
    // replayed through the session's public requestMove surface.
    const engine = (session as any).engine;
    engine.board = emptyBoard();
    engine.board[2]![1] = { color: 'black', king: false };
    engine.board[3]![2] = { color: 'red', king: false };
    engine.turn = 'black';

    const result = session.requestMove(
      'user-black',
      { row: 2, col: 1 },
      { row: 4, col: 3 },
    );
    expect(result.ok).toBe(true);
    expect(session.getWinnerUserId()).toBe('user-black');
  });
});

describe('CheckersSession.leave', () => {
  it('forfeits to the remaining player on explicit leave mid-match', () => {
    const broadcaster = fakeBroadcaster();
    const session = new CheckersSession(identity(), broadcaster);
    const conn1 = {};
    session.addPlayer('user-black', conn1); // black
    session.addPlayer('user-red', {}); // red

    session.leave('user-black', conn1);

    expect(session.getWinnerUserId()).toBe('user-red');
    expect(session.playerCount).toBe(1);
  });
});

describe('CheckersSession.substitutePlayer', () => {
  it("reseats the incoming player into the outgoing player's exact color", () => {
    const session = new CheckersSession(identity(), fakeBroadcaster());
    session.addPlayer('user-black', {}); // black
    session.addPlayer('user-red', {}); // red

    const ok = session.substitutePlayer('user-red', 'user-new', {});
    expect(ok).toBe(true);

    const blackMove = session.requestMove(
      'user-black',
      { row: 2, col: 1 },
      { row: 3, col: 0 },
    );
    expect(blackMove.ok).toBe(true);

    // 'user-new' now owns red's seat: a move from 'user-red' is no longer
    // valid...
    const rejected = session.requestMove(
      'user-red',
      { row: 5, col: 0 },
      { row: 4, col: 1 },
    );
    expect(rejected.ok).toBe(false);
    // ...but the same move from 'user-new' plays as red.
    const accepted = session.requestMove(
      'user-new',
      { row: 5, col: 0 },
      { row: 4, col: 1 },
    );
    expect(accepted.ok).toBe(true);
  });

  it('returns false when the outgoing userId is not seated', () => {
    const session = new CheckersSession(identity(), fakeBroadcaster());
    session.addPlayer('user-black', {});
    expect(session.substitutePlayer('nobody', 'user-new', {})).toBe(false);
  });
});
