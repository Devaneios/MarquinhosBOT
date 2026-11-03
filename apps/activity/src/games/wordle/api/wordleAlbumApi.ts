import { apiBase } from '@/platform/api/apiBase';
import { fetchContract } from '@marquinhos/api-client/browser';
import * as wordle from '@marquinhos/contracts/http/routes/wordle';
import type { z } from 'zod';

export type WordleAlbumPage = z.output<
  typeof wordle.getAlbum.response
>['data'][number];

export async function getWordleAlbum(
  accessToken: string,
  guildId: string,
): Promise<WordleAlbumPage[]> {
  const response = await fetchContract(
    apiBase(),
    wordle.getAlbum,
    { params: { guildId } },
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return response.data;
}
