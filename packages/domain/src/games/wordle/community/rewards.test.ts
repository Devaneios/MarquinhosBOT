import { expect, it } from 'bun:test';
import { WORDLE_ACHIEVEMENT_CATALOG } from '../achievements/catalog';
import { WORDLE_PERSONAL_REWARDS, unlockedWordleRewards } from './rewards';

it('maps the initial title and frame to existing achievements without changing their conditions', () => {
  expect(WORDLE_PERSONAL_REWARDS.map((reward) => reward.kind)).toEqual([
    'title',
    'frame',
  ]);
  for (const reward of WORDLE_PERSONAL_REWARDS) {
    expect(
      WORDLE_ACHIEVEMENT_CATALOG.some(
        (achievement) => achievement.id === reward.achievementId,
      ),
    ).toBe(true);
  }
  expect(unlockedWordleRewards(new Set())).toEqual([]);
  expect(
    unlockedWordleRewards(
      new Set(['wordle_v2_letters_all', 'wordle_v2_wins_100']),
    ),
  ).toEqual(['title_alphabetist', 'frame_century']);
});
