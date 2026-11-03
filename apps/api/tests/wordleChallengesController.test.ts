import { expect, it } from 'bun:test';
import { WordleChallengesController } from '../src/controllers/wordleChallenges.controller';

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

it('creates and joins challenges only as the authenticated player', async () => {
  const calls: unknown[] = [];
  const controller = new WordleChallengesController({
    list: async () => [],
    create: async (...args) => {
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
      };
    },
    join: async (...args) => {
      calls.push(args);
    },
  });
  const created = response();
  await controller.create(
    {
      params: { guildId: 'guild' },
      user: { id: 'owner' },
      body: { patternId: 'letter_a', closesAt: 3 },
    } as never,
    created as never,
  );
  await controller.join(
    {
      params: { guildId: 'guild', challengeId: 'id' },
      user: { id: 'owner' },
    } as never,
    response() as never,
  );
  expect(calls).toEqual([
    ['guild', 'owner', 'letter_a', 3],
    ['id', 'guild', 'owner'],
  ]);
  const forged = response();
  await controller.create(
    {
      params: { guildId: 'guild' },
      user: { id: 'owner' },
      body: { patternId: 'letter_a', closesAt: 3, userId: 'other' },
    } as never,
    forged as never,
  );
  expect(forged.code).toBe(400);
});
