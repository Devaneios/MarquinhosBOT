import { afterAll, expect, it } from 'bun:test';
import { WordleRewardsController } from '../src/modules/wordle/controllers/wordle-rewards.controller';
import {
  InvalidWordleReward,
  WordleRewardsService,
} from '../src/modules/wordle/services/wordle-rewards.service';
import {
  requestController,
  startNestControllerServer,
} from './helpers/nestControllerServer';

const calls: unknown[] = [];
const server = await startNestControllerServer({
  controllers: [WordleRewardsController],
  providers: [
    {
      provide: WordleRewardsService,
      useValue: {
        reconcile: async (user: string) => calls.push(user),
        get: async () => ({ owned: [], title: null, frame: null, badges: [] }),
        equip: async (userId: string, kind: string, rewardId: string | null) =>
          calls.push([userId, kind, rewardId]),
      },
    },
  ],
});
afterAll(() => server.close());

it('uses only the authenticated identity for reconciliation and equipment', async () => {
  const read = await requestController(server, '/wordle/rewards');
  const updated = await requestController(server, '/wordle/rewards', {
    method: 'PUT',
    body: { kind: 'title', rewardId: null },
  });
  expect(calls).toEqual(['owner', 'owner', ['owner', 'title', null]]);
  expect(read.status).toBe(200);
  expect(read.body).toEqual({
    data: { owned: [], title: null, frame: null, badges: [] },
  });
  expect(updated.status).toBe(200);
  expect(updated.body).toEqual({
    data: { owned: [], title: null, frame: null, badges: [] },
  });

  const forged = await requestController(server, '/wordle/rewards', {
    method: 'PUT',
    body: { kind: 'title', rewardId: null, userId: 'other' },
  });
  expect(forged.status).toBe(400);
  expect(forged.body).toEqual({ message: 'Invalid reward' });
});

it('rejects unauthenticated and unowned equipment', async () => {
  const unauthorized = await requestController(server, '/wordle/rewards', {
    token: '',
  });
  expect(unauthorized.status).toBe(401);
  expect(unauthorized.body).toEqual({ message: 'Token not provided' });

  const moduleServer = await startNestControllerServer({
    controllers: [WordleRewardsController],
    providers: [
      {
        provide: WordleRewardsService,
        useValue: {
          reconcile: async () => {},
          get: async () => ({
            owned: [],
            title: null,
            frame: null,
            badges: [],
          }),
          equip: async () => {
            throw new InvalidWordleReward('Invalid reward');
          },
        },
      },
    ],
  });
  try {
    const denied = await requestController(moduleServer, '/wordle/rewards', {
      method: 'PUT',
      body: { kind: 'frame', rewardId: 'frame_century' },
    });
    expect(denied.status).toBe(400);
    expect(denied.body).toEqual({ message: 'Invalid reward' });
  } finally {
    await moduleServer.close();
  }
});
