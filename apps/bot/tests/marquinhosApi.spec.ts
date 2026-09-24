import { HttpClient, HttpError } from '@marquinhos/api-client/bot';
import { beforeEach, describe, expect, it, spyOn } from 'bun:test';
import {
  handleApiResponseError,
  MarquinhosApiService,
} from '../src/services/marquinhosApi';
import * as errorHandling from '../src/utils/errorHandling';

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

  it('does not report a refusal the caller expects, such as an invalid guess', () => {
    const error = new HttpError('Request failed with status 400', {
      response: {
        status: 400,
        data: { message: 'Você já tentou essa palavra' },
      },
      config: { url: '/api/wordle/guess' },
    });

    expect(() => handleApiResponseError(error)).toThrow();
    expect(reportErrorSpy).not.toHaveBeenCalled();
  });

  it('reports a server error', () => {
    const error = new HttpError('Request failed with status 500', {
      response: { status: 500 },
      config: { url: '/api/wordle/guess' },
    });

    expect(() => handleApiResponseError(error)).toThrow();
    expect(reportErrorSpy).toHaveBeenCalledTimes(1);
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

describe('MarquinhosApiService.getWordleLeaderboard', () => {
  it('asks for a given day when the daily ranking has a date', async () => {
    const requestSpy = spyOn(HttpClient.prototype, 'request').mockResolvedValue(
      { data: [], groupStreak: 0 },
    );

    await MarquinhosApiService.getInstance().getWordleLeaderboard(
      'g1',
      'daily',
      '2026-09-23',
    );

    expect(String(requestSpy.mock.calls[0]![0])).toContain('date=2026-09-23');
    requestSpy.mockRestore();
  });
});
