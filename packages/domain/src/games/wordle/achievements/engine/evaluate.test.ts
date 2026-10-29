import { describe, expect, it } from 'bun:test';
import { WORDLE_ACHIEVEMENT_CATALOG } from '../catalog';
import {
  achievementDay,
  epoch,
  failedDay,
  rows,
  solvedDay,
  solvedStreak,
} from '../testing';
import type {
  AchievementHistoryDay,
  WordleEvaluationOptions,
} from './evaluate';
import { evaluateWordleAchievements } from './evaluate';

const today = '2026-10-28';
type Day = AchievementHistoryDay;

function result(
  id: string,
  days: readonly Day[],
  options: WordleEvaluationOptions = { today },
) {
  return evaluateWordleAchievements(days, options).find(
    (entry) => entry.id === id,
  );
}

const asDays = (...days: Parameters<typeof achievementDay>[0][]): Day[] =>
  days.map((day) => achievementDay(day));

describe('evaluateWordleAchievements', () => {
  it('evaluates the full catalog in its declared order', () => {
    expect(
      evaluateWordleAchievements([], { today }).map(({ id }) => id),
    ).toEqual(WORDLE_ACHIEVEMENT_CATALOG.map(({ id }) => id));
    expect(
      evaluateWordleAchievements([], { today }).every(({ met }) => !met),
    ).toBe(true);
  });

  it('caps visible progress and excludes duplicate dates and lifetime streaks', () => {
    const tenWins = asDays(...solvedStreak('2026-01-01', 12));
    expect(result('wordle_v2_wins_10', tenWins)?.progress).toEqual({
      current: 10,
      target: 10,
    });
    expect(
      result('wordle_v2_wins_10', asDays(...solvedStreak('2026-01-01', 9)))
        ?.met,
    ).toBe(false);
    expect(
      result('wordle_v2_played_7', asDays(...solvedStreak('2026-01-01', 6)))
        ?.met,
    ).toBe(false);
    const optionsWithLifetimeStreak = { today, persistedBestStreak: 100 };
    expect(
      evaluateWordleAchievements([], optionsWithLifetimeStreak).some(
        ({ met }) => met,
      ),
    ).toBe(false);
  });

  it('counts wins within the attempt limit and first-solver dates', () => {
    const wins = asDays(
      ...Array.from({ length: 10 }, (_, index) =>
        solvedDay(`2026-01-${String(index + 1).padStart(2, '0')}`, {
          guesses: rows('apaaa', 'ccccc'),
          firstSolverInGuild: true,
        }),
      ),
    );
    expect(result('wordle_v2_wins_within_3_10', wins)?.met).toBe(true);
    expect(result('wordle_v2_first_solver_10', wins)?.progress).toEqual({
      current: 10,
      target: 10,
    });
  });

  it('requires a complete solved matrix for board rules', () => {
    const valid = asDays(solvedDay(today, { guesses: rows('aaaaa', 'ccccc') }));
    const invalid = asDays(
      solvedDay(today, { guesses: rows('aaaaa', 'caaaa') }),
    );
    expect(result('wordle_v2_blank_opening', valid)?.met).toBe(true);
    expect(result('wordle_v2_blank_opening', invalid)?.met).toBe(false);
    expect(result('wordle_v2_all_yellow', asDays(failedDay(today)))?.met).toBe(
      false,
    );
  });

  it('uses configured local time and elapsed boundaries', () => {
    const atMidnight = asDays(
      solvedDay('2026-10-01', {
        startedAt: epoch('2026-10-01T03:00:00Z'),
        solvedAt: epoch('2026-10-01T03:00:30Z'),
        guesses: rows('apaaa', 'ccccc'),
      }),
    );
    const afterMidnight = asDays(
      solvedDay('2026-10-01', {
        startedAt: epoch('2026-10-01T04:00:00Z'),
        solvedAt: epoch('2026-10-01T04:00:30Z'),
        guesses: rows('apaaa', 'ccccc'),
      }),
    );
    expect(result('wordle_v2_midnight', atMidnight)?.met).toBe(true);
    expect(result('wordle_v2_midnight', afterMidnight)?.met).toBe(false);
    expect(result('wordle_v2_fast_60', atMidnight)?.met).toBe(true);
    expect(
      result(
        'wordle_v2_fast_60',
        asDays(
          solvedDay('2026-10-01', {
            startedAt: epoch('2026-10-01T03:00:00Z'),
            solvedAt: epoch('2026-10-01T03:01:01Z'),
            guesses: rows('apaaa', 'ccccc'),
          }),
        ),
      )?.met,
    ).toBe(false);
  });

  it('uses saved discovery identities for individual and collection progress', () => {
    const discoveries = new Set(['letter_a', 'letter_b', 'letter_c']);
    const options = { today, discoveryIds: discoveries };
    expect(result('wordle_v2_pattern_letter_a', [], options)?.met).toBe(true);
    expect(result('wordle_v2_letters_5', [], options)?.progress).toEqual({
      current: 3,
      target: 5,
    });
  });
});
