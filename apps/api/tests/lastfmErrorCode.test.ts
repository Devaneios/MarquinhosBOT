import { AxiosError, AxiosHeaders } from 'axios';
import { describe, expect, it } from 'bun:test';
import { getLastfmErrorCode } from 'services/lastfm';

function axiosErrorWithData(data: unknown) {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', config, null, {
    data,
    status: 403,
    statusText: 'Forbidden',
    headers: {},
    config,
  });
}

describe('getLastfmErrorCode', () => {
  it('reads the Last.fm error code from an axios error response', () => {
    expect(getLastfmErrorCode(axiosErrorWithData({ error: 9 }))).toBe(9);
  });

  it('returns undefined when the response body has no numeric error code', () => {
    expect(getLastfmErrorCode(axiosErrorWithData('oops'))).toBeUndefined();
    expect(
      getLastfmErrorCode(axiosErrorWithData({ error: 'nine' })),
    ).toBeUndefined();
  });

  it('returns undefined for errors that are not axios errors', () => {
    expect(
      getLastfmErrorCode({ response: { data: { error: 9 } } }),
    ).toBeUndefined();
    expect(getLastfmErrorCode(new Error('network'))).toBeUndefined();
  });
});
