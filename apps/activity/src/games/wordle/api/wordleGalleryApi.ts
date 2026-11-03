import { apiBase } from '@/platform/api/apiBase';
import { fetchContract } from '@marquinhos/api-client/browser';
import * as wordle from '@marquinhos/contracts/http/routes/wordle';
import type { z } from 'zod';
export type WordleGallery = z.output<typeof wordle.getGallery.response>['data'];
export async function getWordleGallery(
  token: string,
  guildId: string,
): Promise<WordleGallery> {
  return (
    await fetchContract(
      apiBase(),
      wordle.getGallery,
      { params: { guildId } },
      { headers: { Authorization: `Bearer ${token}` } },
    )
  ).data;
}
