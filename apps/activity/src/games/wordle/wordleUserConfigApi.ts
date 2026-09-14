import { apiUrl } from '../../lib/apiBase';
import { HttpError } from '../../lib/http';
import type { WordleUserConfig } from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseWordleUserConfig(value: unknown): WordleUserConfig {
  if (
    !isRecord(value) ||
    typeof value.invertActionKeys !== 'boolean' ||
    typeof value.enableSounds !== 'boolean' ||
    typeof value.enableSpaceKey !== 'boolean' ||
    typeof value.enableArrowKeys !== 'boolean' ||
    (!value.enableSpaceKey && value.enableArrowKeys)
  ) {
    throw new Error('Invalid Wordle user configuration response');
  }

  const baseConfig = {
    invertActionKeys: value.invertActionKeys,
    enableSounds: value.enableSounds,
  };
  return value.enableSpaceKey
    ? {
        ...baseConfig,
        enableSpaceKey: true,
        enableArrowKeys: value.enableArrowKeys,
      }
    : { ...baseConfig, enableSpaceKey: false, enableArrowKeys: false };
}

async function parseResponse(response: Response, url: string) {
  if (!response.ok) throw new HttpError(response.status, url);
  const payload: unknown = await response.json();
  if (!isRecord(payload)) {
    throw new Error('Invalid Wordle user configuration response');
  }
  return parseWordleUserConfig(payload.data);
}

export async function getWordleUserConfig(
  accessToken: string,
): Promise<WordleUserConfig> {
  const url = apiUrl('/wordle/user-config');
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return parseResponse(response, url);
}

export async function updateWordleUserConfig(
  accessToken: string,
  config: WordleUserConfig,
): Promise<WordleUserConfig> {
  const url = apiUrl('/wordle/user-config');
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(config),
  });
  return parseResponse(response, url);
}
