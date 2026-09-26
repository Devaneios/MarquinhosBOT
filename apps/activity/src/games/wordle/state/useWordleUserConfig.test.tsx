import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, mock } from 'bun:test';
import { useWordleUserConfig } from './useWordleUserConfig';

describe('useWordleUserConfig', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('loads and replaces the active configuration', async () => {
    const fetchRequest = async (
      _input: Parameters<typeof fetch>[0],
      init?: Parameters<typeof fetch>[1],
    ) =>
      new Response(
        JSON.stringify({
          data:
            init?.method === 'PUT'
              ? {
                  invertActionKeys: true,
                  enableSounds: true,
                  enableSpaceKey: true,
                  enableArrowKeys: true,
                }
              : {
                  invertActionKeys: false,
                  enableSounds: false,
                  enableSpaceKey: false,
                  enableArrowKeys: false,
                },
        }),
        { status: 200 },
      );
    globalThis.fetch = Object.assign(fetchRequest, {
      preconnect: originalFetch.preconnect,
    });

    const onAuthInvalid = mock(() => {});
    const { result } = renderHook(() =>
      useWordleUserConfig('token-1', onAuthInvalid),
    );

    await waitFor(() => expect(result.current.status).toBe('ready'));
    if (result.current.status !== 'ready') {
      throw new Error('Expected the configuration to be ready');
    }
    expect(result.current.config).toEqual({
      invertActionKeys: false,
      enableSounds: false,
      enableSpaceKey: false,
      enableArrowKeys: false,
    });

    await act(async () => {
      if (result.current.status !== 'ready') {
        throw new Error('Expected the configuration to be ready');
      }
      await result.current.save({
        invertActionKeys: true,
        enableSounds: true,
        enableSpaceKey: true,
        enableArrowKeys: true,
      });
    });

    expect(result.current).toMatchObject({
      status: 'ready',
      config: {
        invertActionKeys: true,
        enableSounds: true,
        enableSpaceKey: true,
        enableArrowKeys: true,
      },
    });
  });

  it('requests reauthentication after an authentication failure', async () => {
    const fetchRequest = async () => new Response('', { status: 401 });
    globalThis.fetch = Object.assign(fetchRequest, {
      preconnect: originalFetch.preconnect,
    });
    const onAuthInvalid = mock(() => {});

    renderHook(() => useWordleUserConfig('expired-token', onAuthInvalid));

    await waitFor(() => expect(onAuthInvalid).toHaveBeenCalledTimes(1));
  });

  it('retries a failed configuration load', async () => {
    let requestCount = 0;
    const fetchRequest = async () => {
      requestCount += 1;
      if (requestCount === 1) return new Response('', { status: 500 });
      return new Response(
        JSON.stringify({
          data: {
            invertActionKeys: true,
            enableSounds: false,
            enableSpaceKey: true,
            enableArrowKeys: false,
          },
        }),
        { status: 200 },
      );
    };
    globalThis.fetch = Object.assign(fetchRequest, {
      preconnect: originalFetch.preconnect,
    });
    const onAuthInvalid = mock(() => {});
    const { result } = renderHook(() =>
      useWordleUserConfig('token-1', onAuthInvalid),
    );

    await waitFor(() => expect(result.current.status).toBe('error'));
    if (result.current.status !== 'error') {
      throw new Error('Expected the configuration load to fail');
    }
    act(() => {
      if (result.current.status === 'error') result.current.retry();
    });

    await waitFor(() =>
      expect(result.current).toMatchObject({
        status: 'ready',
        config: {
          invertActionKeys: true,
          enableSounds: false,
          enableSpaceKey: true,
          enableArrowKeys: false,
        },
      }),
    );
  });
});
