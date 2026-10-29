import type { LetterFeedback } from '@marquinhos/contracts/wordle';
import { describe, expect, it } from 'bun:test';
import { discoverWordlePatterns } from './discoverPatterns';
import type { AchievementHistoryDay } from './history';

const today = '2026-10-28';

function day(
  date: string,
  rows: LetterFeedback[][],
  solved = false,
): AchievementHistoryDay {
  return {
    date,
    solved,
    attempts: rows.length,
    guesses: rows.map((feedback) => ({
      guess: 'x'.repeat(feedback.length),
      feedback,
    })),
    wordLength: rows[0]?.length ?? null,
    answerHasAccent: null,
    answerHasRepeatedLetters: null,
    startedAt: 1,
    solvedAt: solved ? 2 : null,
    firstSolverInGuild: false,
  };
}

describe('discoverWordlePatterns', () => {
  it('discovers a drawing on a valid in-progress board', () => {
    expect(
      discoverWordlePatterns(
        [
          day(today, [
            ['correct', 'correct', 'correct'],
            ['absent', 'correct', 'absent'],
          ]),
        ],
        { today },
      ).map(({ patternId }) => patternId),
    ).toContain('tetromino_t');
  });

  it('rejects a solved board without a final all-green row', () => {
    expect(
      discoverWordlePatterns(
        [
          day(
            today,
            [
              ['correct', 'correct', 'correct'],
              ['absent', 'correct', 'absent'],
            ],
            true,
          ),
        ],
        { today },
      ),
    ).toEqual([]);
  });

  it('does not discover drawings from future or incomplete histories', () => {
    const drawing = [
      ['correct', 'correct', 'correct'],
      ['absent', 'correct', 'absent'],
    ] satisfies LetterFeedback[][];
    expect(
      discoverWordlePatterns(
        [day('2026-10-29', drawing), { ...day(today, drawing), attempts: 3 }],
        { today },
      ),
    ).toEqual([]);
  });
});
