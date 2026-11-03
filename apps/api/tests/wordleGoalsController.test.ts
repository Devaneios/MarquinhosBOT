import { expect, it } from 'bun:test';
import { WordleGoalsController } from '../src/controllers/wordleGoals.controller';

it('lists the progress of the requested community', async () => {
  const calls: string[] = [];
  const controller = new WordleGoalsController({
    listWithProgress: async (guildId) => {
      calls.push(guildId);
      return [];
    },
    createForDates: async () => {
      throw new Error();
    },
  });
  const res = {
    body: undefined as unknown,
    status() {
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
  await controller.list('a', res);
  expect(calls).toEqual(['a']);
  expect(res.body).toEqual({ data: [] });
});
