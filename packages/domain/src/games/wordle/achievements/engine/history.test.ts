import { describe, expect, it } from 'bun:test';
import {
  achievementDay,
  failedDay,
  rows,
  solvedDay,
  solvedStreak,
} from '../testing';
import { analyzeWordleAchievements } from './evaluate';
import type { AchievementHistoryDay } from './history';

const today = '2026-10-28';
const history = (
  ...days: ReturnType<typeof solvedDay>[]
): AchievementHistoryDay[] => days.map((day) => achievementDay(day));
const met = (id: string, days: readonly AchievementHistoryDay[]) =>
  analyzeWordleAchievements(days, { today })
    .evaluate(new Set())
    .find((entry) => entry.id === id)?.met;

describe('Wordle achievement history', () => {
  it('uses only eligible, distinct played dates for counts and streaks', () => {
    expect(met('wordle_v2_played_1', history(solvedDay('2026-10-29')))).toBe(
      false,
    );
    const duplicate = [
      ...history(solvedDay(today)),
      ...history({ ...solvedDay(today), attempts: 0, guesses: [] }),
    ];
    expect(met('wordle_v2_wins_1', duplicate)).toBe(true);
    expect(
      met('wordle_v2_played_streak_7', history(...solvedStreak(today, 7))),
    ).toBe(false);
    expect(
      met('wordle_v2_calendar_week', history(...solvedStreak('2026-10-19', 7))),
    ).toBe(true);
  });

  it('keeps numerical progress when a board matrix is incomplete', () => {
    const incomplete = achievementDay(
      solvedDay(today, { attempts: 2, guesses: [] }),
    );
    expect(met('wordle_v2_wins_1', [incomplete])).toBe(true);
    expect(met('wordle_v2_blank_opening', [incomplete])).toBe(false);
  });

  it('keeps solved counts but withholds rule evidence without a winning row', () => {
    const solvedWithoutWinningRow = achievementDay(
      solvedDay(today, { guesses: rows('aaaaa', 'ppppp') }),
    );
    expect(met('wordle_v2_wins_1', [solvedWithoutWinningRow])).toBe(true);
    expect(met('wordle_v2_blank_opening', [solvedWithoutWinningRow])).toBe(
      false,
    );
  });

  it('uses answer traits only on solved days', () => {
    const accented = achievementDay(solvedDay(today), {
      answerHasAccent: true,
      answerHasRepeatedLetters: true,
    });
    expect(
      analyzeWordleAchievements([accented], { today })
        .evaluate(new Set())
        .find((entry) => entry.id === 'wordle_v2_accented_answer')?.met,
    ).toBe(true);
    expect(
      analyzeWordleAchievements([{ ...accented, solved: false }], { today })
        .evaluate(new Set())
        .find((entry) => entry.id === 'wordle_v2_accented_answer')?.met,
    ).toBe(false);
  });

  it('counts participation days whether they solve or expire', () => {
    expect(
      met(
        'wordle_v2_played_streak_7',
        history(
          ...Array.from({ length: 7 }, (_, index) =>
            index % 2 === 0
              ? solvedDay(`2026-10-${String(20 + index).padStart(2, '0')}`)
              : failedDay(`2026-10-${String(20 + index).padStart(2, '0')}`),
          ),
        ),
      ),
    ).toBe(true);
  });
});
