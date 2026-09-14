import { afterEach, describe, expect, it } from 'bun:test';
import {
  getWordleUserConfig,
  updateWordleUserConfig,
} from './wordleUserConfigApi';

describe('getWordleUserConfig', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('loads the authenticated user configuration', async () => {
    let requestUrl = '';
    let requestInit: RequestInit | undefined;
    const fetchRequest = async (
      input: Parameters<typeof fetch>[0],
      init?: Parameters<typeof fetch>[1],
    ) => {
      requestUrl = input.toString();
      requestInit = init;
      return new Response(
        JSON.stringify({
          data: { invertActionKeys: true, enableSounds: false },
        }),
        { status: 200 },
      );
    };
    globalThis.fetch = Object.assign(fetchRequest, {
      preconnect: originalFetch.preconnect,
    });

    await expect(getWordleUserConfig('token-1')).resolves.toEqual({
      invertActionKeys: true,
      enableSounds: false,
    });
    expect(requestUrl.endsWith('/api/wordle/user-config')).toBe(true);
    expect(requestInit).toEqual({
      headers: { Authorization: 'Bearer token-1' },
    });
  });

  it('rejects malformed configuration data', async () => {
    const fetchRequest = async () =>
      new Response(
        JSON.stringify({
          data: { invertActionKeys: false, enableSounds: 'yes' },
        }),
        { status: 200 },
      );
    globalThis.fetch = Object.assign(fetchRequest, {
      preconnect: originalFetch.preconnect,
    });

    await expect(getWordleUserConfig('token-1')).rejects.toThrow(
      'Invalid Wordle user configuration response',
    );
  });
});

describe('updateWordleUserConfig', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('replaces the complete authenticated user configuration', async () => {
    let requestUrl = '';
    let requestInit: RequestInit | undefined;
    const fetchRequest = async (
      input: Parameters<typeof fetch>[0],
      init?: Parameters<typeof fetch>[1],
    ) => {
      requestUrl = input.toString();
      requestInit = init;
      return new Response(
        JSON.stringify({
          data: { invertActionKeys: false, enableSounds: true },
        }),
        { status: 200 },
      );
    };
    globalThis.fetch = Object.assign(fetchRequest, {
      preconnect: originalFetch.preconnect,
    });

    await expect(
      updateWordleUserConfig('token-2', {
        invertActionKeys: false,
        enableSounds: true,
      }),
    ).resolves.toEqual({ invertActionKeys: false, enableSounds: true });
    expect(requestUrl.endsWith('/api/wordle/user-config')).toBe(true);
    expect(requestInit).toEqual({
      method: 'PUT',
      headers: {
        Authorization: 'Bearer token-2',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        invertActionKeys: false,
        enableSounds: true,
      }),
    });
  });

  it('exposes authentication failures to the caller', async () => {
    const fetchRequest = async () => new Response('', { status: 401 });
    globalThis.fetch = Object.assign(fetchRequest, {
      preconnect: originalFetch.preconnect,
    });

    await expect(
      updateWordleUserConfig('expired-token', {
        invertActionKeys: false,
        enableSounds: false,
      }),
    ).rejects.toMatchObject({ status: 401 });
  });
});
