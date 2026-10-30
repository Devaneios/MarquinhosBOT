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
import { analyzeWordleAchievements } from './evaluate';

const today = '2026-10-28';
type Day = AchievementHistoryDay;

function result(
  id: string,
  days: readonly Day[],
  options: WordleEvaluationOptions = { today },
  persistedPatternIds: ReadonlySet<string> = new Set(),
) {
  return analyzeWordleAchievements(days, options)
    .evaluate(persistedPatternIds)
    .find((entry) => entry.id === id);
}

const asDays = (...days: Parameters<typeof achievementDay>[0][]): Day[] =>
  days.map((day) => achievementDay(day));

describe('evaluateWordleAchievements', () => {
  it('evaluates the full catalog in its declared order', () => {
    expect(
      analyzeWordleAchievements([], { today })
        .evaluate(new Set())
        .map(({ id }) => id),
    ).toEqual(WORDLE_ACHIEVEMENT_CATALOG.map(({ id }) => id));
    expect(
      analyzeWordleAchievements([], { today })
        .evaluate(new Set())
        .every(({ met }) => !met),
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
      analyzeWordleAchievements([], optionsWithLifetimeStreak)
        .evaluate(new Set())
        .some(({ met }) => met),
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
    for (const id of [
      'wordle_v2_mixed_rows',
      'wordle_v2_improvement',
      'wordle_v2_near_miss',
    ]) {
      expect(result(id, invalid)?.met).toBe(false);
    }
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

  it('requires at least two guesses and caps the fast-solve boundary at sixty seconds', () => {
    const row = (seconds: number, guesses: string[]) =>
      achievementDay(
        solvedDay('2026-10-01', {
          attempts: guesses.length,
          startedAt: epoch('2026-10-01T03:00:00Z'),
          solvedAt: epoch('2026-10-01T03:00:00Z') + seconds,
          guesses: rows(...guesses),
        }),
      );
    expect(
      result(
        'wordle_v2_fast_60',
        asDays(
          solvedDay('2026-10-01', {
            attempts: 1,
            startedAt: epoch('2026-10-01T03:00:00Z'),
            solvedAt: epoch('2026-10-01T03:00:30Z'),
            guesses: rows('ccccc'),
          }),
        ),
      )?.met,
    ).toBe(false);
    expect(
      result('wordle_v2_fast_60', asDays(row(60, ['apaaa', 'ccccc'])))?.met,
    ).toBe(true);
    expect(
      result('wordle_v2_fast_60', asDays(row(61, ['apaaa', 'ccccc'])))?.met,
    ).toBe(false);
  });

  it('uses saved discovery identities for individual and collection progress', () => {
    const discoveries = new Set(['letter_a', 'letter_b', 'letter_c']);
    expect(
      result('wordle_v2_pattern_letter_a', [], { today }, discoveries)?.met,
    ).toBe(true);
    expect(
      result('wordle_v2_letters_5', [], { today }, discoveries)?.progress,
    ).toEqual({
      current: 3,
      target: 5,
    });

    const tetrominoIds = [
      'tetromino_i',
      'tetromino_o',
      'tetromino_t',
      'tetromino_j',
      'tetromino_l',
      'tetromino_s',
      'tetromino_z',
    ];
    const six = new Set(tetrominoIds.slice(0, 6));
    const seven = new Set(tetrominoIds);
    expect(
      result('wordle_v2_tetrominoes_all', [], { today }, six)?.progress,
    ).toEqual({ current: 6, target: 7 });
    expect(result('wordle_v2_tetrominoes_all', [], { today }, six)?.met).toBe(
      false,
    );
    expect(result('wordle_v2_tetrominoes_all', [], { today }, seven)?.met).toBe(
      true,
    );
  });

  it('does not infer absent timing, answer traits, or answer widths', () => {
    const missingEvidence = achievementDay(
      solvedDay(today, {
        startedAt: 0,
        solvedAt: null,
        guesses: rows('apaaa', 'ccccc'),
      }),
      {
        wordLength: null,
        answerHasAccent: null,
        answerHasRepeatedLetters: null,
      },
    );
    const days = [missingEvidence];
    expect(result('wordle_v2_fast_60', days)?.met).toBe(false);
    expect(result('wordle_v2_midnight', days)?.met).toBe(false);
    expect(result('wordle_v2_repeated_letters', days)?.met).toBe(false);
    expect(result('wordle_v2_accented_answer', days)?.met).toBe(false);
    expect(result('wordle_v2_both_lengths', days)?.progress).toEqual({
      current: 0,
      target: 2,
    });
  });

  it('requires solved answers at both supported lengths for the length variety', () => {
    const fiveLetters = achievementDay(
      solvedDay('2026-10-26', { guesses: rows('aaaaa', 'ccccc') }),
    );
    const sixLetters = achievementDay(
      solvedDay('2026-10-27', { guesses: rows('aaaaaa', 'cccccc') }),
    );
    expect(result('wordle_v2_both_lengths', asDays(fiveLetters))?.met).toBe(
      false,
    );
    expect(
      result('wordle_v2_both_lengths', asDays(fiveLetters, sixLetters))?.met,
    ).toBe(true);
  });
});
