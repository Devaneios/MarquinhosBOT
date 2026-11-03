import { apiBase } from '@/platform/api/apiBase';
import { fetchContract } from '@marquinhos/api-client/browser';
import * as wordle from '@marquinhos/contracts/http/routes/wordle';
import type { z } from 'zod';

export type WordleGoal = z.output<
  typeof wordle.listGoals.response
>['data'][number];
export async function getWordleGoals(
  token: string,
  guildId: string,
): Promise<WordleGoal[]> {
  return (
    await fetchContract(
      apiBase(),
      wordle.listGoals,
      { params: { guildId } },
      { headers: { Authorization: `Bearer ${token}` } },
    )
  ).data;
}
