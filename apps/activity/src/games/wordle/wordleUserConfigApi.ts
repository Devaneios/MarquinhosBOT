import { apiBase } from '@/lib/apiBase';
import { fetchContract } from '@marquinhos/api-client/browser';
import * as wordle from '@marquinhos/contracts/http/routes/wordle';
import type { WordleUserConfig } from '@marquinhos/contracts/wordle';

export async function getWordleUserConfig(
  accessToken: string,
): Promise<WordleUserConfig> {
  const response = await fetchContract(
    apiBase(),
    wordle.getUserConfig,
    {},
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return response.data;
}

export async function updateWordleUserConfig(
  accessToken: string,
  config: WordleUserConfig,
): Promise<WordleUserConfig> {
  const response = await fetchContract(
    apiBase(),
    wordle.updateUserConfig,
    { body: config },
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return response.data;
}
