import { apiBase } from '@/platform/api/apiBase';
import { fetchContract } from '@marquinhos/api-client/browser';
import * as wordle from '@marquinhos/contracts/http/routes/wordle';
import type { z } from 'zod';

export type WordleBingoCard = z.output<
  typeof wordle.listBingo.response
>['data'][number];
export async function listWordleBingo(
  token: string,
  guildId: string,
): Promise<WordleBingoCard[]> {
  return (
    await fetchContract(
      apiBase(),
      wordle.listBingo,
      { params: { guildId } },
      { headers: { Authorization: `Bearer ${token}` } },
    )
  ).data;
}
