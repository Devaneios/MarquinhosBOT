import { requestJson } from '@marquinhos/api-client/browser';
import { apiUrl } from '../../lib/apiBase';
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

function parseResponse(payload: unknown) {
  if (!isRecord(payload)) {
    throw new Error('Invalid Wordle user configuration response');
  }
  return parseWordleUserConfig(payload.data);
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
