import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { GameManager } from '../src/game/core/GameManager';
import { GameState, GameType } from '../src/game/core/GameTypes';

let manager: GameManager;

beforeEach(() => {
  (GameManager as any).instance = undefined;
  manager = GameManager.getInstance();
});

afterEach(() => {
  manager.destroy();
  (GameManager as any).instance = undefined;
});

describe('GameManager.createSession / getSession', () => {
  it('returns a session with the expected shape', () => {
    const session = manager.createSession(
      GameType.SLOTS,
      'guild-1',
      'channel-1',
      'host-1',
    );

    expect(session.id).toBeString();
    expect(session.type).toBe(GameType.SLOTS);
    expect(session.guildId).toBe('guild-1');
    expect(session.channelId).toBe('channel-1');
    expect(session.hostId).toBe('host-1');
    expect(session.state).toBe(GameState.WAITING);
    expect(session.players).toEqual([]);
  });

  it('getSession returns the same session by id', () => {
    const session = manager.createSession(
      GameType.BLACKJACK,
      'guild-1',
      'channel-1',
      'host-1',
    );

    expect(manager.getSession(session.id)).toBe(session);
  });

  it('getSession returns undefined for an unknown id', () => {
    expect(manager.getSession('does-not-exist')).toBeUndefined();
  });

  it('each createSession call produces a distinct session id', () => {
    const a = manager.createSession(GameType.SLOTS, 'g', 'c', 'h');
    const b = manager.createSession(GameType.SLOTS, 'g', 'c', 'h');

    expect(a.id).not.toBe(b.id);
  });
});

describe('GameManager.acquireSessionLock', () => {
  it('returns true on first acquisition', () => {
    const session = manager.createSession(GameType.SLOTS, 'g', 'c', 'h');
    expect(manager.acquireSessionLock(session.id)).toBe(true);
  });

  it('returns false on second acquisition without release', () => {
    const session = manager.createSession(GameType.SLOTS, 'g', 'c', 'h');
    manager.acquireSessionLock(session.id);
    expect(manager.acquireSessionLock(session.id)).toBe(false);
  });

  it('returns true again after release', () => {
    const session = manager.createSession(GameType.SLOTS, 'g', 'c', 'h');
    manager.acquireSessionLock(session.id);
    manager.releaseSessionLock(session.id);
    expect(manager.acquireSessionLock(session.id)).toBe(true);
  });
});

describe('GameManager.endSession', () => {
  it('returns true and removes the session', () => {
    const session = manager.createSession(GameType.SLOTS, 'g', 'c', 'h');
    const result = manager.endSession(session.id);

    expect(result).toBe(true);
    expect(manager.getSession(session.id)).toBeUndefined();
  });

  it('returns false for an unknown session id', () => {
    expect(manager.endSession('no-such-id')).toBe(false);
  });

  it('releases the lock when ending a locked session', () => {
    const session = manager.createSession(GameType.SLOTS, 'g', 'c', 'h');
    manager.acquireSessionLock(session.id);
    manager.endSession(session.id);

    const session2 = manager.createSession(GameType.SLOTS, 'g', 'c', 'h');
    expect(manager.acquireSessionLock(session2.id)).toBe(true);
  });
});

describe('GameManager session count', () => {
  it('tracks active session count', () => {
    expect(manager.getActiveSessionsCount()).toBe(0);

    const s1 = manager.createSession(GameType.SLOTS, 'g', 'c', 'h');
    expect(manager.getActiveSessionsCount()).toBe(1);

    manager.createSession(GameType.BLACKJACK, 'g', 'c2', 'h');
    expect(manager.getActiveSessionsCount()).toBe(2);

    manager.endSession(s1.id);
    expect(manager.getActiveSessionsCount()).toBe(1);
  });
});
