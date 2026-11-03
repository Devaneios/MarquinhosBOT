import { describe, expect, it } from 'bun:test';
import { WordleShowcaseController } from '../src/controllers/wordleShowcase.controller';
import { InvalidWordleShowcase } from '../src/services/wordle/WordleShowcaseService';

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

describe('Wordle showcase controller', () => {
  it('uses the authenticated identity for reading and writing', async () => {
    const calls: unknown[] = [];
    const controller = new WordleShowcaseController({
      get: async (userId) => {
        calls.push(userId);
        return ['one'];
      },
      replace: async (userId, ids) => {
        calls.push([userId, ids]);
      },
    });
    const res = response();
    await controller.get({ user: { id: 'owner' } }, res);
    expect(res.body).toEqual({ data: ['one'] });
    await controller.update(
      { user: { id: 'owner' }, body: { achievements: ['one'] } },
      res,
    );
    expect(calls).toEqual(['owner', ['owner', ['one']]]);
  });
  it('rejects unauthenticated and invalid edits', async () => {
    const controller = new WordleShowcaseController({
      get: async () => [],
      replace: async () => {
        throw new InvalidWordleShowcase();
      },
    });
    const missing = response();
    await controller.update({ body: { achievements: [] } }, missing);
    expect(missing.code).toBe(401);
    const invalid = response();
    await controller.update(
      { user: { id: 'owner' }, body: { achievements: ['unowned'] } },
      invalid,
    );
    expect(invalid.code).toBe(400);
    const forged = response();
    await controller.update(
      { user: { id: 'owner' }, body: { achievements: [], userId: 'other' } },
      forged,
    );
    expect(forged.code).toBe(400);
  });
});
