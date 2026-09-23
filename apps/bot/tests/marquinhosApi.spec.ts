import { beforeEach, describe, expect, it, spyOn } from 'bun:test';
import {
  handleApiResponseError,
  MarquinhosApiService,
} from '../src/services/marquinhosApi';
import * as errorHandling from '../src/utils/errorHandling';
import { HttpClient, HttpError } from '@marquinhos/api-client/bot';

describe('handleApiResponseError', () => {
  const reportErrorSpy = spyOn(errorHandling, 'reportError').mockImplementation(
    () => {},
  );

  beforeEach(() => {
    reportErrorSpy.mockClear();
  });

  it('rethrows the original error', () => {
    const error = new HttpError('network down', {
      config: { url: '/api/gamification/xp' },
    });

    expect(() => handleApiResponseError(error)).toThrow('network down');
  });

  it('reports the error with an origin tagged by the request URL', () => {
    const error = new HttpError('network down', {
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
    const error = new HttpError('mystery failure');

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

  it('reports and rethrows non-HttpError values without a config-derived origin', () => {
    const error = new Error('mystery failure');

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
    const postSpy = spyOn(HttpClient.prototype, 'request').mockResolvedValue({
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
      expect.objectContaining({ method: 'POST', timeout: 120000 }),
    );

    postSpy.mockRestore();
  });

  it.each(['trick_riddle', 'praise_thanks', 'follow_up_on_bot'])(
    'accepts the %s category the API classifies into',
    async (category) => {
      const postSpy = spyOn(HttpClient.prototype, 'request').mockResolvedValue({
        data: { status: 'ok', category, reply: 'oi' },
      });

      const response = await MarquinhosApiService.getInstance().respondToTag({
        userId: 'u1',
        guildId: 'g1',
        channelId: 'c1',
        content: 'valeu marquinhos',
        recentMessages: [],
      });

      expect(response.data.category).toBe(category);

      postSpy.mockRestore();
    },
  );
});
