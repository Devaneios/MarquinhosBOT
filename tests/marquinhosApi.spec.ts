import { beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { handleApiResponseError } from '../src/services/marquinhosApi';
import type { ApiError } from '../src/types';
import * as errorHandling from '../src/utils/errorHandling';

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
