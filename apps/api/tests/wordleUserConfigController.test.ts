import { describe, expect, it } from 'bun:test';
import WordleController, {
  type WordleUserConfigStore,
} from 'controllers/wordle.controller';

function makeRequest(body: unknown, userId = 'user-1') {
  return { body, user: { id: userId } };
}

function makeResponse() {
  let statusCode: number | undefined;
  let payload: unknown;
  const response = {
    status(code: number) {
      statusCode = code;
      return response;
    },
    json(data: unknown) {
      payload = data;
      return response;
    },
    getStatus: () => statusCode,
    getPayload: () => payload,
  };
  return response;
}

describe('WordleController user config', () => {
  it('returns only the authenticated user config', () => {
    const calls: string[] = [];
    const store: WordleUserConfigStore = {
      get(userId) {
        calls.push(userId);
        return { invertActionKeys: false, enableSounds: true };
      },
      update() {
        return { invertActionKeys: false, enableSounds: false };
      },
    };
    const controller = new WordleController(store);
    const response = makeResponse();

    controller.getUserConfig(makeRequest(undefined), response);

    expect(calls).toEqual(['user-1']);
    expect(response.getStatus()).toBe(200);
    expect(response.getPayload()).toEqual({
      data: { invertActionKeys: false, enableSounds: true },
    });
  });

  it('replaces the authenticated user config when both fields are booleans', () => {
    const updates: Array<{ userId: string; config: unknown }> = [];
    const store: WordleUserConfigStore = {
      get() {
        return { invertActionKeys: false, enableSounds: false };
      },
      update(userId, config) {
        updates.push({ userId, config });
        return config;
      },
    };
    const controller = new WordleController(store);
    const response = makeResponse();

    controller.updateUserConfig(
      makeRequest({ invertActionKeys: true, enableSounds: false }),
      response,
    );

    expect(updates).toEqual([
      {
        userId: 'user-1',
        config: { invertActionKeys: true, enableSounds: false },
      },
    ]);
    expect(response.getStatus()).toBe(200);
    expect(response.getPayload()).toEqual({
      data: { invertActionKeys: true, enableSounds: false },
    });
  });

  it('rejects partial and non-boolean configurations', () => {
    const store: WordleUserConfigStore = {
      get() {
        return { invertActionKeys: false, enableSounds: false };
      },
      update() {
        throw new Error('must not update');
      },
    };
    const controller = new WordleController(store);

    for (const body of [
      { invertActionKeys: true },
      { invertActionKeys: true, enableSounds: 'yes' },
      null,
    ]) {
      const response = makeResponse();
      controller.updateUserConfig(makeRequest(body), response);
      expect(response.getStatus()).toBe(400);
    }
  });
});
