import { beforeEach, describe, expect, it } from 'bun:test';
import {
  _resetErrorHistoryForTests,
  getRecentErrors,
  recordError,
} from '../src/utils/errorHistory';

beforeEach(() => {
  _resetErrorHistoryForTests();
});

describe('recordError / getRecentErrors', () => {
  it('returns an empty list when nothing has been recorded', () => {
    expect(getRecentErrors()).toEqual([]);
  });

  it('returns entries recorded within the window, most recent last', () => {
    recordError({
      timestamp: new Date(),
      origin: 'a',
      logLevel: 'warn',
      message: 'first',
    });
    recordError({
      timestamp: new Date(),
      origin: 'b',
      logLevel: 'error',
      message: 'second',
    });

    const recent = getRecentErrors();
    expect(recent).toHaveLength(2);
    expect(recent[0]?.origin).toBe('a');
    expect(recent[1]?.origin).toBe('b');
  });

  it('excludes entries older than the given window', () => {
    recordError({
      timestamp: new Date(Date.now() - 20 * 60 * 1000),
      origin: 'old',
      logLevel: 'error',
      message: 'stale',
    });
    recordError({
      timestamp: new Date(),
      origin: 'new',
      logLevel: 'error',
      message: 'fresh',
    });

    const recent = getRecentErrors(15 * 60 * 1000);
    expect(recent).toHaveLength(1);
    expect(recent[0]?.origin).toBe('new');
  });

  it('caps the buffer at 20 entries, dropping the oldest first', () => {
    for (let i = 0; i < 25; i++) {
      recordError({
        timestamp: new Date(),
        origin: `origin-${i}`,
        logLevel: 'error',
        message: `msg-${i}`,
      });
    }

    const recent = getRecentErrors();
    expect(recent).toHaveLength(20);
    expect(recent[0]?.origin).toBe('origin-5');
    expect(recent[19]?.origin).toBe('origin-24');
  });
});
