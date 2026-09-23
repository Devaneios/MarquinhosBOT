import { requestJson } from '@marquinhos/api-client/browser';
import {
  wordleUserConfigSchema,
  type WordleUserConfig,
} from '@marquinhos/contracts/wordle';
import { z } from 'zod';
import { apiUrl } from '../../lib/apiBase';

const wordleUserConfigResponseSchema = z.object({
  data: wordleUserConfigSchema,
});

function parseResponse(payload: unknown): WordleUserConfig {
  const parsed = wordleUserConfigResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error('Invalid Wordle user configuration response');
  }
  return parsed.data.data;
}

export async function getWordleUserConfig(
  accessToken: string,
): Promise<WordleUserConfig> {
  const url = apiUrl('/wordle/user-config');
  const payload = await requestJson(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return parseResponse(payload);
}

export async function updateWordleUserConfig(
  accessToken: string,
  config: WordleUserConfig,
): Promise<WordleUserConfig> {
  const url = apiUrl('/wordle/user-config');
  const payload = await requestJson(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(config),
  });
  return parseResponse(payload);
}
