import { errorMessage, isAuthError } from '@/platform/api/http';
import type { WordleUserConfig } from '@marquinhos/contracts/wordle';
import { useCallback, useEffect, useState } from 'react';
import {
  getWordleUserConfig,
  updateWordleUserConfig,
} from '../api/wordleUserConfigApi';

export type WordleUserConfigState =
  | { status: 'loading' }
  | { status: 'error'; error: string; retry: () => void }
  | {
      status: 'ready';
      config: WordleUserConfig;
      save: (config: WordleUserConfig) => Promise<void>;
    };

export function useWordleUserConfig(
  accessToken: string,
  onAuthInvalid: () => void,
): WordleUserConfigState {
  const [config, setConfig] = useState<WordleUserConfig | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    getWordleUserConfig(accessToken)
      .then((loadedConfig) => {
        if (!cancelled) setConfig(loadedConfig);
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        if (isAuthError(reason)) {
          onAuthInvalid();
          return;
        }
        setLoadError(errorMessage(reason));
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken, attempt, onAuthInvalid]);

  const retry = useCallback(() => {
    setConfig(null);
    setLoadError(null);
    setAttempt((current) => current + 1);
  }, []);

  const save = useCallback(
    async (nextConfig: WordleUserConfig) => {
      try {
        const savedConfig = await updateWordleUserConfig(
          accessToken,
          nextConfig,
        );
        setConfig(savedConfig);
      } catch (reason) {
        if (isAuthError(reason)) onAuthInvalid();
        throw reason;
      }
    },
    [accessToken, onAuthInvalid],
  );

  if (loadError !== null) {
    return { status: 'error', error: loadError, retry };
  }
  if (config === null) return { status: 'loading' };
  return { status: 'ready', config, save };
}
