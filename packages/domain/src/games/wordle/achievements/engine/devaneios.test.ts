import type { LetterFeedback } from '@marquinhos/contracts/wordle';
import { describe, expect, it } from 'bun:test';
import { analyzeWordleAchievements } from './evaluate';
import type { AchievementHistoryDay } from './history';

const today = '2026-10-28';
const achievementId = 'wordle_v2_devaneios_rows';

function row(
  guess: string,
  greenColumns: readonly number[],
  yellowColumns: readonly number[] = [],
): { guess: string; feedback: LetterFeedback[] } {
  return {
    guess,
    feedback: Array.from({ length: guess.length }, (_, column) =>
      greenColumns.includes(column)
        ? 'correct'
        : yellowColumns.includes(column)
          ? 'present'
          : 'absent',
    ),
  };
}

function day(
  date: string,
  guesses: readonly { guess: string; feedback: LetterFeedback[] }[],
  solved = false,
): AchievementHistoryDay {
  return {
    date,
    solved,
    solvedFromDraft: false,
    attempts: guesses.length,
    guesses: [...guesses],
    wordLength: 9,
    answerHasAccent: null,
    answerHasRepeatedLetters: null,
    startedAt: 1,
    solvedAt: solved ? 2 : null,
    firstSolverInGuild: false,
  };
}

function result(days: readonly AchievementHistoryDay[]) {
  return analyzeWordleAchievements(days, { today })
    .evaluate(new Set())
    .find(({ id }) => id === achievementId)!;
}

describe('DEVANEIOS across independently tracked guess rows', () => {
  it('forms DE then VA from nonadjacent green cells on the same row and ignores yellow and grey cells', () => {
    const firstGuess = Array(9).fill('x');
    firstGuess[0] = 'D';
    firstGuess[4] = 'E';
    const secondGuess = Array(9).fill('x');
    secondGuess[1] = 'V';
    secondGuess[3] = 'E';
    secondGuess[7] = 'A';

    expect(
      result([
        day('2026-10-26', [row(firstGuess.join(''), [0, 4])]),
        day('2026-10-28', [row(secondGuess.join(''), [1, 7], [3])]),
      ]),
    ).toMatchObject({ met: false, progress: { current: 4, target: 9 } });
  });

  it('keeps a row prefix when that row was not reached on a later played date', () => {
    const firstRow = Array(9).fill('x');
    firstRow[0] = 'D';
    firstRow[2] = 'E';
    const secondRow = Array(9).fill('x');
    secondRow[1] = 'D';
    secondRow[6] = 'E';
    const continueFirstRow = Array(9).fill('x');
    continueFirstRow[4] = 'E';

    expect(
      result([
        day('2026-10-26', [
          row(firstRow.join(''), [0]),
          row(secondRow.join(''), [1, 6]),
        ]),
        day('2026-10-28', [row(continueFirstRow.join(''), [4])]),
      ]),
    ).toMatchObject({ met: false, progress: { current: 2, target: 9 } });
  });

  it('resets only a row that cannot continue and retries that same row from D', () => {
    const prefix = Array(9).fill('x');
    prefix[0] = 'D';
    prefix[1] = 'E';
    const rowZeroContinuation = Array(9).fill('x');
    rowZeroContinuation[7] = 'V';
    const rowOneRestart = Array(9).fill('x');
    rowOneRestart[2] = 'D';

    const evaluation = result([
      day('2026-10-26', [
        row(prefix.join(''), [0, 1]),
        row(prefix.join(''), [0, 1]),
      ]),
      day('2026-10-28', [
        row(rowZeroContinuation.join(''), [7]),
        row(rowOneRestart.join(''), [2]),
      ]),
    ]);

    // Row zero reaches DEV; row one resets DE, then restarts with D from this row.
    expect(evaluation).toMatchObject({
      met: false,
      progress: { current: 3, target: 9 },
    });
    expect(
      result([
        day('2026-10-26', [row(prefix.join(''), [0, 1])]),
        day('2026-10-28', [row(rowOneRestart.join(''), [2])]),
      ]).progress,
    ).toEqual({ current: 1, target: 9 });
  });

  it('retains a completed word after later rows reset and exposes completion as nine of nine', () => {
    const completed = row('DEVANEIOS', [0, 1, 2, 3, 4, 5, 6, 7, 8]);
    const reset = row('XXXXXXXXX', []);

    expect(
      result([day('2026-10-26', [completed]), day('2026-10-28', [reset])]),
    ).toMatchObject({ met: true, progress: { current: 9, target: 9 } });
  });

  it('does not advance on empty history, an unreached row, a zero-guess win, or invalid board feedback', () => {
    const prefix = row('DxxxxExxx', [0, 5]);
    const malformed = {
      guess: 'xxxxxxxxx',
      feedback: ['correct'] as LetterFeedback[],
    };
    const zeroGuessWin: AchievementHistoryDay = {
      ...day('2026-10-28', [], true),
      attempts: 0,
      solvedFromDraft: true,
    };

    expect(result([])).toMatchObject({
      met: false,
      progress: { current: 0, target: 9 },
    });
    expect(
      result([
        day('2026-10-26', [prefix]),
        day('2026-10-27', [malformed]),
        zeroGuessWin,
      ]),
    ).toMatchObject({ met: false, progress: { current: 2, target: 9 } });
  });

  it('deduplicates dates and excludes future rows before deriving progress', () => {
    expect(
      result([
        day('2026-10-27', [row('Dxxxxxxxx', [0])]),
        day('2026-10-27', [row('xExxxxxxx', [1])]),
        day('2026-10-29', [row('Dxxxxxxxx', [0])]),
      ]),
    ).toMatchObject({ met: false, progress: { current: 0, target: 9 } });
  });
});
