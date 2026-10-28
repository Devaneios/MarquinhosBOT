import { describe, expect, it } from 'bun:test';
import {
  addDays,
  failedDay,
  rows,
  solvedDay,
  solvedStreak,
} from './achievements/testing';
import { computeWordlePlayerStats, solvedRuns } from './playerStats';

const TODAY = '2026-10-24';

describe('computeWordlePlayerStats', () => {
  it('returns zeroed stats for a player without history', () => {
    expect(computeWordlePlayerStats([], { today: TODAY })).toEqual({
      played: 0,
      wins: 0,
      winRate: 0,
      currentStreak: 0,
      bestStreak: 0,
      distribution: [0, 0, 0, 0, 0, 0, 0],
    });
  });

  it('ignores sessions without accepted guesses', () => {
    const empty = failedDay(TODAY, { attempts: 0, guesses: [] });
    expect(computeWordlePlayerStats([empty], { today: TODAY }).played).toBe(0);
  });

  it('counts played days, wins and a rounded win rate', () => {
    const days = [
      solvedDay('2026-10-20'),
      failedDay('2026-10-21'),
      solvedDay('2026-10-22'),
    ];
    const stats = computeWordlePlayerStats(days, { today: TODAY });
    expect(stats.played).toBe(3);
    expect(stats.wins).toBe(2);
    expect(stats.winRate).toBe(67);
  });

  it('buckets the guess distribution with seven or more attempts together', () => {
    const days = [
      solvedDay('2026-10-01', { guesses: rows('ccccc') }),
      solvedDay('2026-10-02', { guesses: rows('aaaaa', 'ccccc') }),
      solvedDay('2026-10-03', { guesses: rows('aaaaa', 'ccccc') }),
      solvedDay('2026-10-04', { attempts: 7 }),
      solvedDay('2026-10-05', { attempts: 25 }),
      failedDay('2026-10-06', { attempts: 3 }),
    ];
    expect(
      computeWordlePlayerStats(days, { today: TODAY }).distribution,
    ).toEqual([1, 2, 0, 0, 0, 0, 2]);
  });

  it('keeps the current streak alive when the last solve was yesterday', () => {
    const days = solvedStreak(addDays(TODAY, -3), 3);
    const stats = computeWordlePlayerStats(days, { today: TODAY });
    expect(stats.currentStreak).toBe(3);
    expect(stats.bestStreak).toBe(3);
  });

  it('keeps the streak alive while today is played but not solved yet', () => {
    const days = [...solvedStreak(addDays(TODAY, -2), 2), failedDay(TODAY)];
    expect(computeWordlePlayerStats(days, { today: TODAY }).currentStreak).toBe(
      2,
    );
  });

  it('resets the current streak after a missed day but keeps the best', () => {
    const days = solvedStreak('2026-10-01', 5);
    const stats = computeWordlePlayerStats(days, { today: TODAY });
    expect(stats.currentStreak).toBe(0);
    expect(stats.bestStreak).toBe(5);
  });

  it('drops the current streak once a whole day passes without a solve', () => {
    const days = solvedStreak(addDays(TODAY, -4), 3);
    expect(computeWordlePlayerStats(days, { today: TODAY }).currentStreak).toBe(
      0,
    );
  });

  it('breaks a streak on a failed day between two solved days', () => {
    const days = [
      solvedDay('2026-10-20'),
      failedDay('2026-10-21'),
      solvedDay('2026-10-22'),
      solvedDay('2026-10-23'),
    ];
    const stats = computeWordlePlayerStats(days, { today: TODAY });
    expect(stats.currentStreak).toBe(2);
    expect(stats.bestStreak).toBe(2);
  });

  it('never reports a best streak below the persisted one', () => {
    const days = [solvedDay(addDays(TODAY, -1))];
    const stats = computeWordlePlayerStats(days, {
      today: TODAY,
      persistedBestStreak: 12,
    });
    expect(stats.bestStreak).toBe(12);
    expect(stats.currentStreak).toBe(1);
  });

  it('does not depend on input order', () => {
    const days = solvedStreak(addDays(TODAY, -4), 4).reverse();
    expect(computeWordlePlayerStats(days, { today: TODAY }).currentStreak).toBe(
      4,
    );
  });

  it('crosses month and year boundaries', () => {
    const days = solvedStreak('2025-12-30', 4);
    expect(
      computeWordlePlayerStats(days, { today: '2026-01-02' }).currentStreak,
    ).toBe(4);
  });
});

describe('solvedRuns', () => {
  it('splits solved days into consecutive runs in chronological order', () => {
    const days = [
      ...solvedStreak('2026-09-01', 3),
      ...solvedStreak('2026-09-10', 2),
      solvedDay('2026-09-20'),
    ];
    expect(solvedRuns(days)).toEqual([3, 2, 1]);
  });
});
