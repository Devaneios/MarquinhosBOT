import { afterAll, expect, it } from 'bun:test';
import { WordleChallengeService } from '../src/modules/wordle/community/wordle-challenge.service';
import { WordleChallengesController } from '../src/modules/wordle/community/wordle-challenges.controller';
import {
  requestController,
  startNestControllerServer,
} from './helpers/nestControllerServer';

const calls: unknown[] = [];
const server = await startNestControllerServer({
  controllers: [WordleChallengesController],
  providers: [
    {
      provide: WordleChallengeService,
      useValue: {
        list: async () => [],
        create: async (...args: unknown[]) => {
          calls.push(args);
          return {
            id: 'id',
            guildId: 'guild',
            creatorId: 'owner',
            patternId: 'letter_a',
            opensAt: 1,
            closesAt: 3,
            status: 'open',
            participants: [],
            joined: true,
          };
        },
        join: async (...args: unknown[]) => {
          calls.push(args);
        },
      },
    },
  ],
});
afterAll(() => server.close());

it('creates and joins challenges only as the authenticated player', async () => {
  const created = await requestController(server, '/wordle/challenges/guild', {
    method: 'POST',
    body: { patternId: 'letter_a', closesAt: 3 },
  });
  const joined = await requestController(
    server,
    '/wordle/challenges/guild/id/join',
    { method: 'POST' },
  );

  expect(calls).toEqual([
    ['guild', 'owner', 'letter_a', 3],
    ['id', 'guild', 'owner'],
  ]);
  expect(created.status).toBe(201);
  expect(created.body).toMatchObject({ data: { creatorId: 'owner' } });
  expect(joined.status).toBe(200);
  expect(joined.body).toEqual({ data: { joined: true } });

  const forged = await requestController(server, '/wordle/challenges/guild', {
    method: 'POST',
    body: { patternId: 'letter_a', closesAt: 3, userId: 'other' },
  });
  expect(forged.status).toBe(400);
  expect(forged.body).toEqual({ message: 'Invalid challenge' });
});
