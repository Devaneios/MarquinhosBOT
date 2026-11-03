import { expect, it } from 'bun:test';
import { WordleGoalsController } from '../src/controllers/wordleGoals.controller';

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

it('allows only verified community members to read goal progress', async () => {
  let reads = 0;
  const store = {
    listWithProgress: async () => {
      reads++;
      return [];
    },
    createForDates: async () => {
      throw new Error();
    },
  };
  const denied = new WordleGoalsController(store, async () => false);
  const res = response();
  await denied.list(
    {
      user: { id: 'user' },
      params: { guildId: 'a' },
      headers: { authorization: 'Bearer token' },
    },
    res,
  );
  expect(res.code).toBe(403);
  expect(reads).toBe(0);
  const allowed = new WordleGoalsController(store, async () => true);
  const ok = response();
  await allowed.list(
    {
      user: { id: 'user' },
      params: { guildId: 'a' },
      headers: { authorization: 'Bearer token' },
    },
    ok,
  );
  expect(ok.body).toEqual({ data: [] });
});
