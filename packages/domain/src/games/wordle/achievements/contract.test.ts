import type { LetterFeedback } from '@marquinhos/contracts/wordle';
import { describe, expect, it } from 'bun:test';
import { WORDLE_ACHIEVEMENT_CATALOG, WORDLE_DRAWING_CATALOG } from './catalog';
import {
  analyzeWordleAchievements,
  type AchievementHistoryDay,
  type WordleEvaluationOptions,
} from './engine/evaluate';
import {
  achievementDay,
  epoch,
  failedDay,
  rows,
  solvedDay,
  solvedStreak,
} from './testing';

const today = '2026-10-24';
const startedAt = epoch('2026-02-01T12:00:00Z');
const greenWord = (word: string) => [
  {
    guess: word,
    feedback: Array.from(
      { length: word.length },
      (): LetterFeedback => 'correct',
    ),
  },
];
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
  solvedDay('2026-01-07', {
    attempts: 0,
    guesses: [],
    solvedFromDraft: true,
  }),
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
  solvedDay('2026-03-09', { guesses: rows('aaaaa', 'ccccp', 'ccccc') }),
  solvedDay('2026-03-10', { guesses: rows('aaaaa', 'aaaaa', 'ccccc') }),
  solvedDay('2026-03-11', { guesses: rows('ccccp', 'cccca', 'ccccc') }),
  solvedDay('2026-03-12', { guesses: rows('ppppp', 'ppppp', 'ccccc') }),
  solvedDay('2026-03-13', { guesses: rows('ppppp', 'cccpp', 'ccccc') }),
  solvedDay('2026-03-14', { guesses: greenWord('desejo') }),
  solvedDay('2026-03-15', { guesses: greenWord('chuva') }),
  solvedDay('2026-03-16', { guesses: greenWord('nenhuma') }),
  solvedDay('2026-03-17', { guesses: greenWord('vitorioso') }),
].map((day) =>
  achievementDay(day, {
    answerHasAccent: true,
    answerHasRepeatedLetters: true,
  }),
);

const lifetimeStreakOptions = { today, persistedBestStreak: 999 };

const cases: {
  name: string;
  days: readonly AchievementHistoryDay[];
  options: WordleEvaluationOptions;
  persistedPatternIds?: readonly string[];
}[] = [
  { name: 'empty history', days: [], options: { today } },
  {
    name: 'completed collection',
    days: completed,
    options: { today },
    persistedPatternIds: WORDLE_DRAWING_CATALOG.map(
      (drawing) => drawing.patternId,
    ),
  },
  {
    name: 'partial history and one discovery',
    days: [
      achievementDay(solvedDay('2026-10-23', { guesses: rows('ccccc') })),
      achievementDay(failedDay(today)),
    ],
    options: { today },
    persistedPatternIds: ['letter_a'],
  },
  {
    name: 'duplicate future and malformed history',
    days: [
      achievementDay(solvedDay('2026-10-20')),
      achievementDay(failedDay('2026-10-20')),
      achievementDay(solvedDay('2026-10-21', { attempts: 20 })),
      achievementDay(
        solvedDay('2026-10-22', { startedAt, solvedAt: startedAt - 1 }),
      ),
      achievementDay(solvedDay('2026-10-25', { guesses: rows('ccccc') })),
    ],
    options: lifetimeStreakOptions,
  },
  {
    name: 'clock and elapsed boundaries',
    days: [
      achievementDay(
        solvedDay('2026-10-20', { startedAt, solvedAt: startedAt + 60 }),
      ),
      achievementDay(
        solvedDay('2026-10-21', { solvedAt: epoch('2026-10-21T05:00:00Z') }),
      ),
      achievementDay(
        solvedDay('2026-10-22', { solvedAt: epoch('2026-10-22T08:00:00Z') }),
      ),
    ],
    options: { today, timeZone: 'UTC' },
  },
];

describe('achievement behavior contract', () => {
  it('preserves the complete metadata and drawing geometry projection', () => {
    expect(
      WORDLE_ACHIEVEMENT_CATALOG.map(({ evaluate: _evaluate, ...definition }) =>
        JSON.stringify(definition),
      ).join('\n'),
    ).toMatchSnapshot();
  });

  it('preserves drawing geometry and its order', () => {
    expect(
      WORDLE_DRAWING_CATALOG.map((entry) => JSON.stringify(entry)).join('\n'),
    ).toMatchSnapshot();
  });

  it('runs each complete definition through its pure evaluator', () => {
    expect(
      WORDLE_ACHIEVEMENT_CATALOG.every(
        (definition) => typeof definition.evaluate === 'function',
      ),
    ).toBe(true);
    expect(
      analyzeWordleAchievements([], { today })
        .evaluate(new Set())
        .every((result) => !result.met),
    ).toBe(true);
    expect(
      analyzeWordleAchievements(completed, cases[1]!.options)
        .evaluate(new Set(cases[1]!.persistedPatternIds))
        .every((result) => result.met),
    ).toBe(true);
  });

  for (const sample of cases) {
    it(`preserves evaluation for ${sample.name}`, () => {
      expect(
        analyzeWordleAchievements(sample.days, sample.options)
          .evaluate(new Set(sample.persistedPatternIds))
          .map((result) => JSON.stringify(result))
          .join('\n'),
      ).toMatchSnapshot();
    });
  }
});
