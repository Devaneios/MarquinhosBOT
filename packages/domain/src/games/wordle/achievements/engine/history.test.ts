import { describe, expect, it } from 'bun:test';
import type { WordleDayRecord } from '../../playerStats';
import {
  addDays,
  epoch,
  failedDay,
  rows,
  solvedDay,
  solvedStreak,
} from '../testing';
import { evaluateWordleRule } from './evaluate';
import {
  buildWordleAchievementFacts,
  parseAchievementMatrix,
  type AchievementHistoryDay,
} from './history';
import type { WordleAchievementRule } from './rules';

const today = '2026-10-26';
const check = (
  rule: WordleAchievementRule,
  days: WordleDayRecord[],
  options = {},
) =>
  evaluateWordleRule(
    rule,
    buildWordleAchievementFacts(days, { today, ...options }),
  );
const history = (
  day: WordleDayRecord,
  extras: Partial<AchievementHistoryDay> = {},
): AchievementHistoryDay => ({
  ...day,
  feedback: day.guesses.map((g) => g.feedback),
  wordLength: 5,
  answerHasRepeatedLetters: false,
  answerHasAccent: false,
  ...extras,
});

describe('version 2 history facts', () => {
  it('ignores persisted lifetime streaks and duplicate dates', () => {
    expect(
      check({ kind: 'streak', days: 3 }, [solvedDay(today)], {
        persistedBestStreak: 100,
      }).met,
    ).toBe(false);
    expect(
      check({ kind: 'played', days: 2 }, [solvedDay(today), solvedDay(today)])
        .met,
    ).toBe(false);
  });
  it('keeps a played date when a later duplicate record has no attempts', () => {
    const empty = {
      ...solvedDay(today),
      solved: false,
      attempts: 0,
      guesses: [],
    };
    expect(
      check({ kind: 'wins', count: 1 }, [solvedDay(today), empty]).met,
    ).toBe(true);
  });
  it('counts participation streaks across unsolved dates, but never across a gap', () => {
    const days = [
      failedDay('2026-10-20'),
      solvedDay('2026-10-21'),
      failedDay('2026-10-22'),
    ];
    expect(check({ kind: 'played_streak', days: 3 }, days).met).toBe(true);
    expect(
      check({ kind: 'played_streak', days: 4 }, [
        ...days,
        solvedDay('2026-10-24'),
      ]).met,
    ).toBe(false);
  });
  it('requires completed Monday through Sunday weeks and exact calendar months', () => {
    const week = solvedStreak('2026-10-19', 7);
    expect(check({ kind: 'calendar_coverage', period: 'week' }, week).met).toBe(
      true,
    );
    expect(
      check({ kind: 'calendar_coverage', period: 'week' }, week.slice(1)).met,
    ).toBe(false);
    expect(
      check(
        { kind: 'calendar_coverage', period: 'week' },
        solvedStreak('2026-10-20', 7),
      ).met,
    ).toBe(false);
    expect(
      check({ kind: 'calendar_coverage', period: 'week' }, week, {
        today: '2026-10-25',
      }).met,
    ).toBe(false);
    expect(
      check(
        { kind: 'calendar_coverage', period: 'month' },
        solvedStreak('2026-09-01', 30),
      ).met,
    ).toBe(true);
    expect(
      check(
        { kind: 'calendar_coverage', period: 'month' },
        solvedStreak('2026-09-02', 29),
      ).met,
    ).toBe(false);
    expect(
      check(
        { kind: 'calendar_coverage', period: 'month' },
        solvedStreak('2026-10-01', 31),
        { today: '2026-10-31' },
      ).met,
    ).toBe(false);
    expect(
      check(
        { kind: 'calendar_coverage', period: 'month' },
        solvedStreak('2028-02-01', 29),
        { today: '2028-03-01' },
      ).met,
    ).toBe(true);
  });
  it('distinguishes current in-progress games, absence, failure and next-date recovery', () => {
    expect(check({ kind: 'expired_unsolved' }, [failedDay(today)]).met).toBe(
      false,
    );
    expect(check({ kind: 'expired_unsolved' }, []).met).toBe(false);
    expect(
      check({ kind: 'expired_unsolved' }, [failedDay('2026-10-25')]).met,
    ).toBe(true);
    expect(
      check({ kind: 'recovery' }, [failedDay('2026-10-25'), solvedDay(today)])
        .met,
    ).toBe(true);
    expect(
      check({ kind: 'recovery' }, [failedDay('2026-10-24'), solvedDay(today)])
        .met,
    ).toBe(false);
  });
  it('requires an earlier eligible played day and seven intervening absent dates', () => {
    expect(
      check({ kind: 'return_after_gap', days: 7 }, [solvedDay(today)]).met,
    ).toBe(false);
    expect(
      check({ kind: 'return_after_gap', days: 7 }, [
        failedDay(addDays(today, -7)),
        solvedDay(today),
      ]).met,
    ).toBe(false);
    expect(
      check({ kind: 'return_after_gap', days: 7 }, [
        failedDay(addDays(today, -8)),
        solvedDay(today),
      ]).met,
    ).toBe(true);
  });
  it('uses exact precision and six distinct attempt counts', () => {
    expect(
      check({ kind: 'solved_exactly', attempts: 2 }, [
        solvedDay(today, { attempts: 1 }),
      ]).met,
    ).toBe(false);
    expect(
      check({ kind: 'solved_exactly', attempts: 2 }, [
        solvedDay(today, { attempts: 2 }),
      ]).met,
    ).toBe(true);
    expect(
      check(
        { kind: 'attempt_variety', maxAttempts: 6 },
        Array.from({ length: 6 }, (_, i) =>
          solvedDay(addDays(today, -i), { attempts: i + 1 }),
        ),
      ).met,
    ).toBe(true);
    expect(
      check({ kind: 'attempt_variety', maxAttempts: 6 }, [
        solvedDay(today, { attempts: 7 }),
      ]).progress,
    ).toEqual({ current: 0, target: 6 });
  });
  it('uses complete matrices for yellow, mixed rows, improvements and near misses', () => {
    expect(
      check({ kind: 'all_yellow_row' }, [
        history(failedDay(today, { guesses: rows('ppppp') })),
      ]).met,
    ).toBe(true);
    expect(
      check({ kind: 'mixed_rows', count: 3 }, [
        history(
          solvedDay(today, {
            guesses: rows('cpaaa', 'acpaa', 'aacpa', 'ccccc'),
          }),
        ),
      ]).met,
    ).toBe(true);
    expect(
      check({ kind: 'mixed_rows', count: 3 }, [
        history(
          solvedDay(today, {
            guesses: rows('cpaaa', 'aaaaa', 'acpaa', 'aacpa', 'ccccc'),
          }),
        ),
      ]).met,
    ).toBe(false);
    expect(
      check({ kind: 'near_miss' }, [
        history(solvedDay(today, { guesses: rows('cccca', 'ccccc') })),
      ]).met,
    ).toBe(true);
    expect(
      check({ kind: 'staircase', minAttempts: 3 }, [
        history(solvedDay(today, { guesses: rows('aaaaa', 'caaaa', 'ccccc') })),
      ]).met,
    ).toBe(true);
    const corrupt = history(
      solvedDay(today, { guesses: rows('ppppp', 'ccccc') }),
      { feedback: null },
    );
    expect(check({ kind: 'all_yellow_row' }, [corrupt]).met).toBe(false);
    expect(check({ kind: 'wins', count: 1 }, [corrupt]).met).toBe(true);
  });
  it('rejects missing or reversed elapsed timestamps and includes exact boundaries', () => {
    const start = epoch(`${today}T12:00:00Z`);
    const fast = {
      kind: 'fast_solve',
      seconds: 30,
      minAttempts: 2,
    } satisfies WordleAchievementRule;
    expect(
      check(fast, [
        solvedDay(today, { startedAt: start, solvedAt: start + 30 }),
      ]).met,
    ).toBe(true);
    expect(
      check(fast, [
        solvedDay(today, { startedAt: start, solvedAt: start + 31 }),
      ]).met,
    ).toBe(false);
    expect(
      check(fast, [solvedDay(today, { startedAt: 0, solvedAt: 20 })]).met,
    ).toBe(false);
    expect(
      check(fast, [solvedDay(today, { startedAt: start, solvedAt: null })]).met,
    ).toBe(false);
    expect(
      check({ kind: 'slow_solve', seconds: 3600 }, [
        solvedDay(today, { startedAt: start, solvedAt: start + 3600 }),
      ]).met,
    ).toBe(true);
    expect(
      check({ kind: 'slow_solve', seconds: 3600 }, [
        solvedDay(today, { startedAt: start, solvedAt: start - 3600 }),
      ]).met,
    ).toBe(false);
  });
  it('honors exact local-clock boundaries', () => {
    for (const [fromHour, toHour] of [
      [0, 1],
      [5, 8],
      [22, 24],
    ]) {
      const rule = {
        kind: 'solved_at_hours',
        fromHour,
        toHour,
      } satisfies WordleAchievementRule;
      const at = (hour: number, minutes = 0, seconds = 0) =>
        solvedDay(today, {
          solvedAt:
            epoch(`${today}T00:00:00Z`) + hour * 3600 + minutes * 60 + seconds,
        });
      expect(check(rule, [at(fromHour)], { timeZone: 'UTC' }).met).toBe(true);
      expect(
        check(rule, [at(toHour - 1, 59, 59)], { timeZone: 'UTC' }).met,
      ).toBe(true);
      expect(check(rule, [at(toHour % 24)], { timeZone: 'UTC' }).met).toBe(
        false,
      );
    }
  });
  it('uses answer facts and both supported answer lengths only on solved dates', () => {
    const five = history(solvedDay('2026-10-25'));
    const six = history(solvedDay(today), {
      wordLength: 6,
      answerHasRepeatedLetters: true,
      answerHasAccent: true,
    });
    expect(check({ kind: 'answer_lengths' }, [five, six]).met).toBe(true);
    expect(check({ kind: 'answer_lengths' }, [five]).met).toBe(false);
    expect(
      check({ kind: 'answer_vocabulary', feature: 'repeated_letters' }, [six])
        .met,
    ).toBe(true);
    expect(
      check({ kind: 'answer_vocabulary', feature: 'accent' }, [six]).met,
    ).toBe(true);
    expect(
      check({ kind: 'answer_vocabulary', feature: 'accent' }, [
        { ...six, solved: false },
      ]).met,
    ).toBe(false);
  });
  it('counts durable discoveries by identity and family only', () => {
    const discoveryIds = new Set([
      'letter_a',
      'letter_b',
      'letter_c',
      'letter_d',
      'letter_e',
      'digit_0',
      'unknown',
    ]);
    expect(
      check({ kind: 'pattern', patternId: 'letter_a' }, [], { discoveryIds })
        .met,
    ).toBe(true);
    expect(
      check({ kind: 'pattern_collection', family: 'letter', count: 5 }, [], {
        discoveryIds,
      }).progress,
    ).toEqual({ current: 5, target: 5 });
    expect(
      check({ kind: 'pattern_collection', family: 'digit', count: 5 }, [], {
        discoveryIds,
      }).progress,
    ).toEqual({ current: 1, target: 5 });
  });
});

describe('parseAchievementMatrix', () => {
  const valid = JSON.stringify([
    {
      guess: 'teste',
      feedback: ['correct', 'present', 'absent', 'absent', 'absent'],
    },
  ]);
  it('preserves all accepted rows', () =>
    expect(parseAchievementMatrix(valid, 5, 1)).toEqual(
      rows('cpaaa').map((row) => row.feedback),
    ));
  it('rejects corrupt middle rows rather than joining the neighbors', () => {
    const rows = [
      {
        guess: 'teste',
        feedback: ['correct', 'present', 'absent', 'absent', 'absent'],
      },
      { guess: 'ruim', feedback: ['invalid'] },
      {
        guess: 'teste',
        feedback: ['correct', 'present', 'absent', 'absent', 'absent'],
      },
    ];
    expect(parseAchievementMatrix(JSON.stringify(rows), 5, 3)).toBeNull();
  });
  it('rejects a guess whose length disagrees with its feedback width', () => {
    expect(
      parseAchievementMatrix(
        JSON.stringify([
          {
            guess: 'four',
            feedback: ['correct', 'present', 'absent', 'absent', 'absent'],
          },
        ]),
        5,
        1,
      ),
    ).toBeNull();
  });
  it('rejects malformed JSON, unknown width, mismatched counters and row widths', () => {
    for (const [json, width, attempts] of [
      [valid, null, 1],
      [valid, 6, 1],
      [valid, 5, 2],
      ['bad', 5, 1],
      ['[]', 5, 0],
    ] satisfies [string, number | null, number][])
      expect(parseAchievementMatrix(json, width, attempts)).toBeNull();
  });
});
