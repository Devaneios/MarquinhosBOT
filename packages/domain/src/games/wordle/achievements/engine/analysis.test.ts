import type { LetterFeedback } from '@marquinhos/contracts/wordle';
import { describe, expect, it } from 'bun:test';
import { WORDLE_ACHIEVEMENT_CATALOG } from '../catalog';
import { analyzeWordleAchievements } from './evaluate';
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
    solvedFromDraft: false,
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

const drawing: LetterFeedback[][] = [
  ['correct', 'correct', 'correct'],
  ['absent', 'correct', 'absent'],
];

describe('analyzeWordleAchievements', () => {
  it('evaluates empty history in catalog order', () => {
    const result = analyzeWordleAchievements([], { today }).evaluate(new Set());
    expect(result.map(({ id }) => id)).toEqual(
      WORDLE_ACHIEVEMENT_CATALOG.map(({ id }) => id),
    );
    expect(result.every(({ met }) => !met)).toBe(true);
  });

  it('caps progress after excluding duplicate and future dates', () => {
    const solved = (date: string) => day(date, [['correct']], true);
    const history = analyzeWordleAchievements(
      [
        ...Array.from({ length: 12 }, (_, index) =>
          solved(`2026-01-${String(index + 1).padStart(2, '0')}`),
        ),
        solved('2026-01-01'),
        solved('2026-10-29'),
      ],
      { today },
    );
    expect(
      history.evaluate(new Set()).find((row) => row.id === 'wordle_v2_wins_10'),
    ).toMatchObject({ met: true, progress: { current: 10, target: 10 } });
  });

  it('discovers only unknown drawings and retains the earliest evidence', () => {
    const analysis = analyzeWordleAchievements(
      [day('2026-01-02', drawing), day('2026-01-01', drawing)],
      { today },
    );

    expect(analysis.discoverPatterns(new Set(['tetromino_t']))).toEqual([]);
    expect(
      analysis
        .discoverPatterns(new Set())
        .find(({ patternId }) => patternId === 'tetromino_t'),
    ).toMatchObject({ patternId: 'tetromino_t', date: '2026-01-01' });
  });

  it('discovers a valid in-progress board', () => {
    expect(
      analyzeWordleAchievements([day(today, drawing)], { today })
        .discoverPatterns(new Set())
        .map(({ patternId }) => patternId),
    ).toContain('tetromino_t');
  });

  it('withholds all board evidence when a solved history has no winning row', () => {
    const invalidSolvedBoard = day(
      today,
      [
        ['absent', 'absent', 'absent'],
        ['present', 'present', 'present'],
      ],
      true,
    );
    const analysis = analyzeWordleAchievements([invalidSolvedBoard], { today });
    const results = new Map(
      analysis.evaluate(new Set()).map((row) => [row.id, row]),
    );

    expect(results.get('wordle_v2_wins_1')?.met).toBe(true);
    expect(results.get('wordle_v2_blank_opening')?.met).toBe(false);
    expect(results.get('wordle_v2_all_yellow')?.met).toBe(false);
    expect(analysis.discoverPatterns(new Set())).toEqual([]);
  });
});
