import { beforeEach, describe, expect, it, spyOn } from 'bun:test';
import {
  handleApiResponseError,
  MarquinhosApiService,
} from '../src/services/marquinhosApi';
import type { ApiError } from '../src/types';
import * as errorHandling from '../src/utils/errorHandling';
import { HttpClient } from '../src/utils/httpClient';

describe('handleApiResponseError', () => {
  const reportErrorSpy = spyOn(
    errorHandling,
    'reportError',
  ).mockImplementation(() => {});

  beforeEach(() => {
    reportErrorSpy.mockClear();
  });

  it('rethrows the original error', () => {
    const error: ApiError = Object.assign(new Error('network down'), {
      config: { url: '/api/gamification/xp' },
    });

    expect(() => handleApiResponseError(error)).toThrow('network down');
  });

  it('reports the error with an origin tagged by the request URL', () => {
    const error: ApiError = Object.assign(new Error('network down'), {
      config: { url: '/api/gamification/xp' },
    });

    try {
      handleApiResponseError(error);
    } catch {
      // expected — assertions are on the reportError call below
    }

    expect(reportErrorSpy).toHaveBeenCalledWith(error, {
      origin: 'API:/api/gamification/xp',
      logLevel: 'warn',
    });
  });

  it('falls back to "unknown" origin when the request URL is missing', () => {
    const error: ApiError = new Error('mystery failure');

    try {
      handleApiResponseError(error);
    } catch {
      // expected
    }

    expect(reportErrorSpy).toHaveBeenCalledWith(error, {
      origin: 'API:unknown',
      logLevel: 'warn',
    });
  });
});

describe('MarquinhosApiService.respondToTag', () => {
  it('uses a 120 second timeout, since an agent_task reply can involve a multi-iteration tool-calling loop that outlasts the default timeout', async () => {
    const postSpy = spyOn(HttpClient.prototype, 'post').mockResolvedValue({
      data: { status: 'ok' },
    });

    await MarquinhosApiService.getInstance().respondToTag({
      userId: 'u1',
      guildId: 'g1',
      channelId: 'c1',
      content: 'lista os arquivos em /repo',
      recentMessages: [],
    });

    expect(postSpy).toHaveBeenCalledWith(
      '/api/ai-chat/respond',
      expect.objectContaining({ userId: 'u1' }),
      { timeout: 120000 },
    );

    postSpy.mockRestore();
  });
});
