import { expect, it } from 'bun:test';
import { WordleRewardsController } from '../src/controllers/wordleRewards.controller';
import { InvalidWordleReward } from '../src/services/wordle/WordleRewardsService';

function response() {
  return {
    code: 200,
    body: undefined as unknown,
    status(code: number) {
      this.code = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
}

it('uses only the authenticated identity for reconciliation and equipment', async () => {
  const calls: unknown[] = [];
  const controller = new WordleRewardsController({
    reconcile: async (user) => {
      calls.push(user);
    },
    get: async () => ({ owned: [], title: null, frame: null, badges: [] }),
    equip: async (...args) => {
      calls.push(args);
    },
  });
  const res = response();
  await controller.get({ user: { id: 'owner' } }, res);
  await controller.update(
    { user: { id: 'owner' }, body: { kind: 'title', rewardId: null } },
    res,
  );
  expect(calls).toEqual(['owner', 'owner', ['owner', 'title', null]]);
  const forged = response();
  await controller.update(
    {
      user: { id: 'owner' },
      body: { kind: 'title', rewardId: null, userId: 'other' },
    },
    forged,
  );
  expect(forged.code).toBe(400);
});

it('rejects unauthenticated and unowned equipment', async () => {
  const controller = new WordleRewardsController({
    reconcile: async () => {},
    get: async () => ({ owned: [], title: null, frame: null, badges: [] }),
    equip: async () => {
      throw new InvalidWordleReward();
    },
  });
  const missing = response();
  await controller.get({}, missing);
  expect(missing.code).toBe(401);
  const denied = response();
  await controller.update(
    {
      user: { id: 'owner' },
      body: { kind: 'frame', rewardId: 'frame_century' },
    },
    denied,
  );
  expect(denied.code).toBe(400);
});
