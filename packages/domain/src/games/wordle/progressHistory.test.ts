import { describe, expect, test } from 'bun:test';
import { computePreservedWordleStats } from './progressHistory';

const legacy = (
  sessionId: string,
  date: string,
  solved: boolean,
  attempts = 1,
) => ({
  source: 'legacy' as const,
  sessionId,
  date,
  solved,
  solvedFromDraft: false,
  attempts,
});

describe('computePreservedWordleStats', () => {
  test('counts distinct source sessions while retaining same-date guild games', () => {
    const stats = computePreservedWordleStats(
      [
        legacy('one', '2026-11-09', true),
        legacy('two', '2026-11-09', false),
        legacy('one', '2026-11-09', true),
        { ...legacy('global', '2026-11-10', true), source: 'global' as const },
      ],
      { today: '2026-11-10' },
    );
    expect(stats.played).toBe(3);
    expect(stats.wins).toBe(2);
    expect(stats.distribution.reduce((sum, count) => sum + count, 0)).toBe(2);
  });

  test('counts one streak date when multiple sessions were solved that day', () => {
    const stats = computePreservedWordleStats(
      [
        legacy('one', '2026-11-09', true),
        legacy('two', '2026-11-09', true),
        legacy('three', '2026-11-10', true),
      ],
      { today: '2026-11-10' },
    );
    expect(stats.currentStreak).toBe(2);
    expect(stats.bestStreak).toBe(2);
  });

  test('extends a saved streak anchor and preserves its best floor', () => {
    const stats = computePreservedWordleStats(
      [legacy('new', '2026-11-10', true)],
      {
        today: '2026-11-10',
        carryover: {
          currentStreak: 8,
          bestStreak: 20,
          lastSolvedDate: '2026-11-09',
        },
      },
    );
    expect(stats.currentStreak).toBe(9);
    expect(stats.bestStreak).toBe(20);
  });

  test('requires real ISO calendar dates at the aggregation boundary', () => {
    expect(() =>
      computePreservedWordleStats([], { today: '2026-02-30' }),
    ).toThrow('valid ISO date');
  });

  test('expires carryover after a missed day and cannot resume from a stale anchor', () => {
    expect(
      computePreservedWordleStats([], {
        today: '2026-11-11',
        carryover: {
          currentStreak: 8,
          bestStreak: 20,
          lastSolvedDate: '2026-11-09',
        },
      }).currentStreak,
    ).toBe(0);
    expect(
      computePreservedWordleStats([legacy('new', '2026-11-11', true)], {
        today: '2026-11-11',
        carryover: {
          currentStreak: 8,
          bestStreak: 20,
          lastSolvedDate: '2026-11-09',
        },
      }).currentStreak,
    ).toBe(1);
  });
});
