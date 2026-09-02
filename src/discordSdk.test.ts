import { describe, expect, it, mock } from 'bun:test';

function fakeSdkClass(onConstruct: () => void, close: ReturnType<typeof mock>) {
  return class {
    close = close;
    constructor() {
      onConstruct();
    }
  };
}

async function freshDiscordSdkModule() {
  let constructCount = 0;
  const close = mock(() => {});
  mock.module('@discord/embedded-app-sdk', () => ({
    DiscordSDK: fakeSdkClass(() => {
      constructCount += 1;
    }, close),
    DiscordSDKMock: fakeSdkClass(() => {
      constructCount += 1;
    }, close),
    Platform: { MOBILE: 'mobile', DESKTOP: 'desktop' },
  }));
  (globalThis as unknown as { window: unknown }).window = {
    self: {},
    top: {},
  };
  const mod = await import(`./discordSdk.ts?${Math.random()}`);
  return { mod, close, constructCount: () => constructCount };
}

describe('resetDiscordSdk', () => {
  it('forces a fresh instance to be constructed without telling Discord to close the activity', async () => {
    const { mod, close, constructCount } = await freshDiscordSdkModule();

    const first = mod.getDiscordSdk();
    expect(constructCount()).toBe(1);
    expect(mod.getDiscordSdk()).toBe(first);
    expect(constructCount()).toBe(1);

    mod.resetDiscordSdk();
    // instance.close() posts an RPC CLOSE message to Discord's client, which
    // treats it as "this activity is done" and tears down the iframe — that
    // is not recoverable from inside the page, so a reset must never send it.
    expect(close).not.toHaveBeenCalled();

    const second = mod.getDiscordSdk();
    expect(constructCount()).toBe(2);
    expect(second).not.toBe(first);
  });
});
