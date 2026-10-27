import { describe, expect, it } from 'bun:test';
import { WORDLE_ACHIEVEMENT_CATALOG } from './catalog';
import {
  buildWordleAchievementFacts,
  evaluateWordleAchievements,
  evaluateWordleRule,
} from './evaluate';
import { LEGACY_WORDLE_ACHIEVEMENT_CATALOG } from './legacyCatalog';
import type { WordleAchievementRule } from './rules';
import type { WordleDayRecord } from './stats';
import { epoch, failedDay, rows, solvedDay, solvedStreak } from './testing';

const TODAY = '2026-10-24';

function check(rule: WordleAchievementRule, days: WordleDayRecord[]) {
  return evaluateWordleRule(
    rule,
    buildWordleAchievementFacts(days, { today: TODAY }),
  );
}

describe('evaluateWordleRule', () => {
  describe('counters', () => {
    it('reports wins progress capped at the target', () => {
      const days = solvedStreak('2026-01-01', 12);
      expect(check({ kind: 'wins', count: 10 }, days)).toEqual({
        met: true,
        progress: { current: 10, target: 10 },
      });
      expect(check({ kind: 'wins', count: 25 }, days)).toEqual({
        met: false,
        progress: { current: 12, target: 25 },
      });
    });

    it('meets the wins threshold exactly at the boundary', () => {
      expect(
        check({ kind: 'wins', count: 3 }, solvedStreak('2026-01-01', 2)).met,
      ).toBe(false);
      expect(
        check({ kind: 'wins', count: 3 }, solvedStreak('2026-01-01', 3)).met,
      ).toBe(true);
    });

    it('counts unsolved days as played', () => {
      const days = [failedDay('2026-10-01'), solvedDay('2026-10-02')];
      expect(check({ kind: 'played', days: 2 }, days).met).toBe(true);
    });

    it('uses the best streak, so a broken streak keeps its achievement', () => {
      const days = solvedStreak('2026-01-01', 7);
      expect(check({ kind: 'streak', days: 7 }, days)).toEqual({
        met: true,
        progress: { current: 7, target: 7 },
      });
    });

    it('counts only wins within the attempt limit', () => {
      const days = [
        solvedDay('2026-10-01', { guesses: rows('apaaa', 'acaaa', 'ccccc') }),
        solvedDay('2026-10-02', { attempts: 4 }),
        solvedDay('2026-10-03', { guesses: rows('ccccc') }),
      ];
      expect(
        check({ kind: 'wins_within', maxAttempts: 3, count: 10 }, days),
      ).toEqual({ met: false, progress: { current: 2, target: 10 } });
    });

    it('counts first-solver days only when the day was solved', () => {
      const days = [
        solvedDay('2026-10-01', { firstSolverInGuild: true }),
        failedDay('2026-10-02', { firstSolverInGuild: true }),
        solvedDay('2026-10-03'),
      ];
      expect(check({ kind: 'first_solver', count: 10 }, days)).toEqual({
        met: false,
        progress: { current: 1, target: 10 },
      });
      expect(check({ kind: 'first_solver', count: 1 }, days).met).toBe(true);
    });
  });

  describe('one-shot rules', () => {
    it('solved_within requires a solved day within the limit', () => {
      const days = [
        failedDay('2026-10-01', { guesses: rows('ccaaa') }),
        solvedDay('2026-10-02', { guesses: rows('aaaaa', 'ccccc') }),
      ];
      expect(check({ kind: 'solved_within', maxAttempts: 1 }, days)).toEqual({
        met: false,
        progress: null,
      });
      expect(check({ kind: 'solved_within', maxAttempts: 2 }, days).met).toBe(
        true,
      );
    });

    it('solved_after rewards persistence but not unsolved marathons', () => {
      expect(
        check({ kind: 'solved_after', minAttempts: 10 }, [
          failedDay('2026-10-01', { attempts: 30 }),
        ]).met,
      ).toBe(false);
      expect(
        check({ kind: 'solved_after', minAttempts: 10 }, [
          solvedDay('2026-10-01', { attempts: 10 }),
        ]).met,
      ).toBe(true);
    });

    it('fast_solve measures from the first guess to the solve', () => {
      const start = epoch('2026-10-01T15:00:00Z');
      const fast = solvedDay('2026-10-01', {
        guesses: rows('aaaaa', 'apaaa', 'ccccc'),
        startedAt: start,
        solvedAt: start + 60,
      });
      expect(
        check({ kind: 'fast_solve', seconds: 60, minAttempts: 3 }, [fast]).met,
      ).toBe(true);
      expect(
        check({ kind: 'fast_solve', seconds: 30, minAttempts: 3 }, [fast]).met,
      ).toBe(false);
    });

    it('fast_solve ignores lucky short games and legacy rows without solvedAt', () => {
      const start = epoch('2026-10-01T15:00:00Z');
      const rule: WordleAchievementRule = {
        kind: 'fast_solve',
        seconds: 60,
        minAttempts: 3,
      };
      expect(
        check(rule, [
          solvedDay('2026-10-01', {
            guesses: rows('aaaaa', 'ccccc'),
            startedAt: start,
            solvedAt: start + 5,
          }),
        ]).met,
      ).toBe(false);
      expect(
        check(rule, [
          solvedDay('2026-10-02', {
            guesses: rows('aaaaa', 'apaaa', 'ccccc'),
            solvedAt: null,
          }),
        ]).met,
      ).toBe(false);
    });

    it('solved_at_hours uses America/Recife local time with an exclusive end', () => {
      const rule: WordleAchievementRule = {
        kind: 'solved_at_hours',
        fromHour: 5,
        toHour: 7,
      };
      const at = (iso: string) =>
        solvedDay('2026-10-01', { solvedAt: epoch(iso) });
      expect(check(rule, [at('2026-10-01T08:00:00Z')]).met).toBe(true);
      expect(check(rule, [at('2026-10-01T09:59:59Z')]).met).toBe(true);
      expect(check(rule, [at('2026-10-01T10:00:00Z')]).met).toBe(false);
      expect(check(rule, [at('2026-10-01T07:59:59Z')]).met).toBe(false);
    });

    it('solved_at_hours honours a configured time zone', () => {
      const facts = buildWordleAchievementFacts(
        [solvedDay('2026-10-01', { solvedAt: epoch('2026-10-01T06:00:00Z') })],
        { today: TODAY, timeZone: 'UTC' },
      );
      expect(
        evaluateWordleRule(
          { kind: 'solved_at_hours', fromHour: 5, toHour: 7 },
          facts,
        ).met,
      ).toBe(true);
    });

    it('clean_solve rejects any yellow letter on the way', () => {
      const rule: WordleAchievementRule = {
        kind: 'clean_solve',
        minAttempts: 3,
      };
      expect(
        check(rule, [
          solvedDay('2026-10-01', {
            guesses: rows('caaaa', 'ccaaa', 'ccccc'),
          }),
        ]).met,
      ).toBe(true);
      expect(
        check(rule, [
          solvedDay('2026-10-01', {
            guesses: rows('caaap', 'ccaaa', 'ccccc'),
          }),
        ]).met,
      ).toBe(false);
      expect(
        check(rule, [
          solvedDay('2026-10-01', { guesses: rows('caaaa', 'ccccc') }),
        ]).met,
      ).toBe(false);
    });

    it('blank_start needs an all-grey opener and a quick recovery', () => {
      const rule: WordleAchievementRule = {
        kind: 'blank_start',
        maxAttempts: 5,
      };
      expect(
        check(rule, [
          solvedDay('2026-10-01', {
            guesses: rows('aaaaa', 'pacaa', 'ccccc'),
          }),
        ]).met,
      ).toBe(true);
      expect(
        check(rule, [
          solvedDay('2026-10-01', {
            guesses: rows('aaaaa', 'aaaaa', 'aaaaa', 'pacaa', 'cccca', 'ccccc'),
          }),
        ]).met,
      ).toBe(false);
      expect(
        check(rule, [
          solvedDay('2026-10-01', { guesses: rows('paaaa', 'ccccc') }),
        ]).met,
      ).toBe(false);
    });

    it('staircase needs strictly more greens on every guess', () => {
      const rule: WordleAchievementRule = { kind: 'staircase', minAttempts: 4 };
      expect(
        check(rule, [
          solvedDay('2026-10-01', {
            guesses: rows('aaaaa', 'caaaa', 'ccaap', 'ccccc'),
          }),
        ]).met,
      ).toBe(true);
      expect(
        check(rule, [
          solvedDay('2026-10-01', {
            guesses: rows('caaaa', 'caaaa', 'ccaaa', 'ccccc'),
          }),
        ]).met,
      ).toBe(false);
      expect(
        check(rule, [
          solvedDay('2026-10-01', { guesses: rows('caaaa', 'ccaaa', 'ccccc') }),
        ]).met,
      ).toBe(false);
    });

    it('style rules require complete guess evidence for the whole day', () => {
      const legacy = solvedDay('2026-10-01', { guesses: [], attempts: 5 });
      const partial = solvedDay('2026-10-02', {
        guesses: rows('aaaaa', 'caaaa', 'ccaaa', 'ccccc'),
        attempts: 6,
      });
      const unsolvedLastRow = solvedDay('2026-10-03', {
        guesses: rows('aaaaa', 'caaaa', 'ccaaa', 'cccca'),
      });
      const ragged = solvedDay('2026-10-04', {
        guesses: [...rows('aaaaa', 'caaaa', 'ccaaa'), ...rows('cccc')],
      });
      for (const day of [legacy, partial, unsolvedLastRow, ragged]) {
        expect(check({ kind: 'clean_solve', minAttempts: 3 }, [day]).met).toBe(
          false,
        );
        expect(check({ kind: 'blank_start', maxAttempts: 5 }, [day]).met).toBe(
          false,
        );
        expect(check({ kind: 'staircase', minAttempts: 4 }, [day]).met).toBe(
          false,
        );
      }
    });

    it('fast_solve rejects a solve recorded before the first guess', () => {
      const start = epoch('2026-10-01T15:00:00Z');
      expect(
        check({ kind: 'fast_solve', seconds: 60, minAttempts: 3 }, [
          solvedDay('2026-10-01', {
            guesses: rows('aaaaa', 'apaaa', 'ccccc'),
            startedAt: start,
            solvedAt: start - 600,
          }),
        ]).met,
      ).toBe(false);
    });

    it('phoenix needs two separate qualifying streaks', () => {
      const rule: WordleAchievementRule = { kind: 'phoenix', days: 7 };
      const first = solvedStreak('2026-09-01', 7);
      expect(check(rule, first).met).toBe(false);
      expect(
        check(rule, [...first, ...solvedStreak('2026-09-09', 6)]).met,
      ).toBe(false);
      expect(
        check(rule, [...first, ...solvedStreak('2026-09-09', 7)]).met,
      ).toBe(true);
    });
  });
});

describe('evaluateWordleAchievements', () => {
  it('still renders the explicitly selected legacy catalog with its lifetime streak progress', () => {
    const result = evaluateWordleAchievements(
      [],
      { today: TODAY, persistedBestStreak: 7 },
      LEGACY_WORDLE_ACHIEVEMENT_CATALOG,
    );
    expect(result.map((r) => r.id)).toEqual(
      LEGACY_WORDLE_ACHIEVEMENT_CATALOG.map((d) => d.id),
    );
    expect(result.find((r) => r.id === 'wordle_streak_7')?.met).toBe(true);
    expect(
      evaluateWordleAchievements([], {
        today: TODAY,
        persistedBestStreak: 7,
      }).some((r) => r.met),
    ).toBe(false);
  });
  it('evaluates every catalog entry in catalog order', () => {
    const result = evaluateWordleAchievements([], { today: TODAY });
    expect(result.map((r) => r.id)).toEqual(
      WORDLE_ACHIEVEMENT_CATALOG.map((d) => d.id),
    );
    expect(result.every((r) => !r.met)).toBe(true);
  });

  it('unlocks the expected set for a first-guess win today', () => {
    const result = evaluateWordleAchievements(
      [
        solvedDay(TODAY, {
          guesses: rows('ccccc'),
          firstSolverInGuild: true,
          solvedAt: epoch(`${TODAY}T09:00:00Z`),
          startedAt: epoch(`${TODAY}T09:00:00Z`),
        }),
      ],
      { today: TODAY },
    );
    expect(result.filter((r) => r.met).map((r) => r.id)).toEqual([
      'wordle_v2_wins_1',
      'wordle_v2_played_1',
      'wordle_v2_solved_exactly_1',
      'wordle_v2_morning',
      'wordle_v2_first_solver_1',
    ]);
  });
});
