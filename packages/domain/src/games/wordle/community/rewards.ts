export const WORDLE_PERSONAL_REWARDS = [
  {
    id: 'title_alphabetist',
    kind: 'title',
    name: 'Alfabetista',
    achievementId: 'wordle_v2_letters_all',
  },
  {
    id: 'frame_century',
    kind: 'frame',
    name: 'Moldura das cem soluções',
    achievementId: 'wordle_v2_wins_100',
  },
] as const;

export type WordlePersonalReward = (typeof WORDLE_PERSONAL_REWARDS)[number];
export type WordlePersonalRewardId = WordlePersonalReward['id'];

export function unlockedWordleRewards(
  achievementIds: ReadonlySet<string>,
): WordlePersonalRewardId[] {
  return WORDLE_PERSONAL_REWARDS.filter((reward) =>
    achievementIds.has(reward.achievementId),
  ).map((reward) => reward.id);
}
