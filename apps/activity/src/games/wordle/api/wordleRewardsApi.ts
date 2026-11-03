import { apiBase } from '@/platform/api/apiBase';
import { fetchContract } from '@marquinhos/api-client/browser';
import * as wordle from '@marquinhos/contracts/http/routes/wordle';
import type { z } from 'zod';

export type WordleRewardsState = z.output<
  typeof wordle.getRewards.response
>['data'];
export async function getWordleRewards(
  token: string,
): Promise<WordleRewardsState> {
  return (
    await fetchContract(
      apiBase(),
      wordle.getRewards,
      {},
      { headers: { Authorization: `Bearer ${token}` } },
    )
  ).data;
}
export async function equipWordleReward(
  token: string,
  kind: 'title' | 'frame',
  rewardId: string | null,
): Promise<WordleRewardsState> {
  return (
    await fetchContract(
      apiBase(),
      wordle.updateReward,
      { body: { kind, rewardId } },
      { headers: { Authorization: `Bearer ${token}` } },
    )
  ).data;
}
