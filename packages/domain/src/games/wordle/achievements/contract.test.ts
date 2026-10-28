import { describe, expect, it } from 'bun:test';
import type { WordleDayRecord } from '../playerStats';
import {
  WORDLE_ACHIEVEMENT_CATALOG,
  WORDLE_ACHIEVEMENT_VERSION,
} from './catalog';
import { evaluateWordleAchievements } from './engine/evaluate';
import {
  toAchievementHistoryDay,
  type AchievementHistoryDay,
  type WordleEvaluationOptions,
} from './engine/history';
import { wordleAchievementRuleSchema } from './engine/rules';
import { WORDLE_PATTERN_CATALOG } from './patterns';
import { epoch, failedDay, rows, solvedDay, solvedStreak } from './testing';

const today = '2026-10-24';
const startedAt = epoch('2026-02-01T12:00:00Z');
const completed: AchievementHistoryDay[] = [
  ...solvedStreak('2025-01-01', 365, { firstSolverInGuild: true }),
  solvedDay('2026-01-01', {
    guesses: rows('aaaaa', 'caaaa', 'ccaaa', 'ccccc'),
  }),
  solvedDay('2026-01-02', { guesses: rows('ppppp', 'ccccc') }),
  solvedDay('2026-01-03', {
    guesses: rows('capaa', 'capaa', 'capaa', 'ccccc'),
  }),
  solvedDay('2026-01-04', { guesses: rows('cccca', 'ccccc') }),
  failedDay('2026-01-05'),
  solvedDay('2026-01-06'),
  solvedDay('2026-02-01', { startedAt, solvedAt: startedAt + 30 }),
  solvedDay('2026-02-02', { startedAt, solvedAt: startedAt + 3600 }),
  solvedDay('2026-02-03', { solvedAt: epoch('2026-02-03T03:00:00Z') }),
  solvedDay('2026-02-04', { solvedAt: epoch('2026-02-04T08:00:00Z') }),
  solvedDay('2026-02-05', { solvedAt: epoch('2026-02-06T01:00:00Z') }),
  ...Array.from({ length: 6 }, (_, i) =>
    solvedDay(`2026-03-0${i + 1}`, {
      guesses: rows(...Array.from({ length: i }, () => 'apaaa'), 'ccccc'),
    }),
  ),
  solvedDay('2026-03-07', {
    guesses: rows(...Array.from({ length: 19 }, () => 'apaaa'), 'ccccc'),
  }),
  solvedDay('2026-03-08', { guesses: rows('apaaaa', 'cccccc') }),
].map((day) => ({
  ...toAchievementHistoryDay(day),
  answerHasAccent: true,
  answerHasRepeatedLetters: true,
}));

const cases: {
  name: string;
  days: readonly WordleDayRecord[];
  options: WordleEvaluationOptions;
}[] = [
  { name: 'empty history', days: [], options: { today } },
  {
    name: 'completed collection',
    days: completed,
    options: {
      today,
      discoveryIds: new Set(WORDLE_PATTERN_CATALOG.map((p) => p.id)),
    },
  },
  {
    name: 'partial history and one discovery',
    days: [
      solvedDay('2026-10-23', { guesses: rows('ccccc') }),
      failedDay(today),
    ],
    options: { today, discoveryIds: new Set(['letter_a']) },
  },
  {
    name: 'duplicate future and malformed history',
    days: [
      solvedDay('2026-10-20'),
      failedDay('2026-10-20'),
      solvedDay('2026-10-21', { attempts: 20 }),
      solvedDay('2026-10-22', { startedAt, solvedAt: startedAt - 1 }),
      solvedDay('2026-10-25', { guesses: rows('ccccc') }),
    ],
    options: { today, persistedBestStreak: 999 },
  },
  {
    name: 'clock and elapsed boundaries',
    days: [
      solvedDay('2026-10-20', { startedAt, solvedAt: startedAt + 60 }),
      solvedDay('2026-10-21', { solvedAt: epoch('2026-10-21T05:00:00Z') }),
      solvedDay('2026-10-22', { solvedAt: epoch('2026-10-22T08:00:00Z') }),
    ],
    options: { today, timeZone: 'UTC' },
  },
];

describe('achievement behavior contract', () => {
  it('preserves the expanded catalog and exact serialized rules', () => {
    expect(WORDLE_ACHIEVEMENT_VERSION).toBe(2);
    expect(
      WORDLE_ACHIEVEMENT_CATALOG.map((entry) => JSON.stringify(entry)).join(
        '\n',
      ),
    ).toMatchSnapshot();
  });

  it('preserves normalized patterns and their order', () => {
    expect(
      WORDLE_PATTERN_CATALOG.map((entry) => JSON.stringify(entry)).join('\n'),
    ).toMatchSnapshot();
  });

  it('exercises every rule kind with met and unmet results', () => {
    const kinds = wordleAchievementRuleSchema.options.map(
      (schema) => schema.shape.kind.value,
    );
    expect(
      new Set(WORDLE_ACHIEVEMENT_CATALOG.map((entry) => entry.rule.kind)),
    ).toEqual(new Set(kinds));
    expect(
      evaluateWordleAchievements([], { today }).every((result) => !result.met),
    ).toBe(true);
    expect(
      evaluateWordleAchievements(completed, cases[1]!.options).every(
        (result) => result.met,
      ),
    ).toBe(true);
  });

  for (const sample of cases) {
    it(`preserves evaluation for ${sample.name}`, () => {
      expect(
        evaluateWordleAchievements(sample.days, sample.options)
          .map((result) => JSON.stringify(result))
          .join('\n'),
      ).toMatchSnapshot();
    });
  }
});
