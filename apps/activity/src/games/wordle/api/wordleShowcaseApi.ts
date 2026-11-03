import { apiBase } from '@/platform/api/apiBase';
import { fetchContract } from '@marquinhos/api-client/browser';
import * as wordle from '@marquinhos/contracts/http/routes/wordle';

export async function getWordleShowcase(
  accessToken: string,
): Promise<string[]> {
  const response = await fetchContract(
    apiBase(),
    wordle.getShowcase,
    {},
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return response.data;
}

export async function updateWordleShowcase(
  accessToken: string,
  achievements: string[],
): Promise<string[]> {
  const response = await fetchContract(
    apiBase(),
    wordle.updateShowcase,
    { body: { achievements } },
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return response.data;
}
