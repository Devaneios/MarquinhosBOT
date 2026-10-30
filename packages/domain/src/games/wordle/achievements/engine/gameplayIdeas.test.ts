import type { LetterFeedback } from '@marquinhos/contracts/wordle';
import { describe, expect, it } from 'bun:test';
import { analyzeWordleAchievements } from './evaluate';
import type { AchievementHistoryDay } from './history';

const today = '2026-10-28';
const green: LetterFeedback[] = Array(5).fill('correct');
const grey: LetterFeedback[] = Array(5).fill('absent');
const yellow: LetterFeedback[] = Array(5).fill('present');
const nearMiss: LetterFeedback[] = [
  'correct',
  'correct',
  'correct',
  'correct',
  'absent',
];
const mixedAnagram: LetterFeedback[] = [
  'correct',
  'present',
  'correct',
  'present',
  'correct',
];

function day(rows: LetterFeedback[][], solved = false): AchievementHistoryDay {
  return {
    date: today,
    solved,
    solvedFromDraft: false,
    attempts: rows.length,
    guesses: rows.map((feedback) => ({
      guess: 'x'.repeat(feedback.length),
      feedback,
    })),
    wordLength: 5,
    answerHasAccent: null,
    answerHasRepeatedLetters: null,
    startedAt: 1,
    solvedAt: solved ? 2 : null,
    firstSolverInGuild: false,
  };
}

function met(id: string, record: AchievementHistoryDay) {
  return analyzeWordleAchievements([record], { today })
    .evaluate(new Set())
    .find((result) => result.id === id)?.met;
}

describe('confirmed gameplay achievements', () => {
  it('awards exactly three solves and rejects other guess counts', () => {
    expect(
      met('wordle_v2_solved_exactly_3', day([grey, nearMiss, green], true)),
    ).toBe(true);
    expect(
      met('wordle_v2_solved_exactly_3', day([nearMiss, green], true)),
    ).toBe(false);
    expect(met('wordle_v2_solved_exactly_3', day([green], true))).toBe(false);
  });

  it('counts only a finalized draft as a zero-attempt win, without board evidence or participation', () => {
    const zeroGuessWin: AchievementHistoryDay = {
      ...day([], true),
      attempts: 0,
      solvedFromDraft: true,
    };
    const analysis = analyzeWordleAchievements([zeroGuessWin], { today });
    const results = new Map(
      analysis.evaluate(new Set()).map((entry) => [entry.id, entry]),
    );

    expect(results.get('wordle_v2_zero_attempt_solve')?.met).toBe(true);
    expect(results.get('wordle_v2_wins_1')?.met).toBe(true);
    expect(results.get('wordle_v2_played_1')?.met).toBe(false);
    expect(results.get('wordle_v2_played_streak_7')?.met).toBe(false);
    expect(analysis.discoverPatterns(new Set())).toEqual([]);
  });

  it('does not treat a draft win as a timed or fast-attempt solve', () => {
    const lateStamp = Date.UTC(2026, 9, 29, 2, 59, 59) / 1000;
    const draftWins: AchievementHistoryDay[] = Array.from(
      { length: 10 },
      (_, index) => ({
        ...day([], true),
        date: `2026-10-${String(10 + index).padStart(2, '0')}`,
        attempts: 0,
        solvedFromDraft: true,
        solvedAt: lateStamp,
      }),
    );
    const results = new Map(
      analyzeWordleAchievements(draftWins, { today })
        .evaluate(new Set())
        .map((entry) => [entry.id, entry]),
    );

    expect(results.get('wordle_v2_late')?.met).toBe(false);
    expect(results.get('wordle_v2_wins_within_3_10')?.met).toBe(false);
    expect(results.get('wordle_v2_zero_attempt_solve')?.met).toBe(true);
  });

  it('requires two consecutive all-grey rows before a valid winning row', () => {
    expect(
      met('wordle_v2_blank_twice_then_solved', day([grey, grey, green], true)),
    ).toBe(true);
    expect(
      met(
        'wordle_v2_blank_twice_then_solved',
        day([grey, yellow, grey, green], true),
      ),
    ).toBe(false);
    expect(
      met('wordle_v2_blank_twice_then_solved', day([grey, green], true)),
    ).toBe(false);
    expect(
      met('wordle_v2_blank_twice_then_solved', day([grey, grey], false)),
    ).toBe(false);
  });

  it('counts two one-letter near misses even during an unfinished game', () => {
    expect(
      met('wordle_v2_near_miss_twice', day([nearMiss, grey, nearMiss], false)),
    ).toBe(true);
    expect(met('wordle_v2_near_miss_twice', day([nearMiss], false))).toBe(
      false,
    );
    expect(
      met(
        'wordle_v2_near_miss_twice',
        day(
          [nearMiss, ['correct', 'correct', 'correct', 'absent', 'absent']],
          false,
        ),
      ),
    ).toBe(false);
  });

  it('requires every pre-solve row to be yellow for yellow-only wins', () => {
    expect(
      met(
        'wordle_v2_yellow_only_before_solve',
        day([yellow, yellow, green], true),
      ),
    ).toBe(true);
    expect(
      met(
        'wordle_v2_yellow_only_before_solve',
        day([mixedAnagram, green], true),
      ),
    ).toBe(false);
    expect(
      met(
        'wordle_v2_yellow_only_before_solve',
        day(
          [
            yellow,
            ['present', 'present', 'present', 'present', 'absent'],
            green,
          ],
          true,
        ),
      ),
    ).toBe(false);
    expect(met('wordle_v2_yellow_only_before_solve', day([green], true))).toBe(
      false,
    );
  });

  it('allows all-green/yellow anagrams but rejects any grey pre-solve cell', () => {
    expect(
      met(
        'wordle_v2_anagrams_only_before_solve',
        day([yellow, mixedAnagram, green], true),
      ),
    ).toBe(true);
    expect(
      met(
        'wordle_v2_anagrams_only_before_solve',
        day([mixedAnagram, green], true),
      ),
    ).toBe(true);
    expect(
      met(
        'wordle_v2_anagrams_only_before_solve',
        day(
          [
            yellow,
            ['correct', 'correct', 'correct', 'correct', 'absent'],
            green,
          ],
          true,
        ),
      ),
    ).toBe(false);
    expect(
      met('wordle_v2_anagrams_only_before_solve', day([green], true)),
    ).toBe(false);
    expect(met('wordle_v2_all_yellow', day([yellow], false))).toBe(true);
    expect(
      met('wordle_v2_blank_opening', day([grey, yellow, green], true)),
    ).toBe(true);
  });
});
