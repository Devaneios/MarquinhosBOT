import { describe, expect, it } from 'bun:test';
import { WordleAlbumController } from '../src/controllers/wordleAlbum.controller';

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

describe('community album authorization', () => {
  it('returns the requested community only after verifying Discord membership', async () => {
    const calls: string[] = [];
    const controller = new WordleAlbumController(
      {
        pages: async (guild) => {
          calls.push(guild);
          return [];
        },
      },
      async (token, guild) => {
        calls.push(`${token}:${guild}`);
        return true;
      },
    );
    const res = response();
    await controller.get(
      {
        user: { id: 'user' },
        params: { guildId: 'community' },
        headers: { authorization: 'Bearer token' },
      },
      res,
    );
    expect(calls).toEqual(['token:community', 'community']);
    expect(res.body).toEqual({ data: [] });
  });
  it('does not expose an album to a nonmember or when Discord is unavailable', async () => {
    let reads = 0;
    for (const check of [
      async () => false,
      async () => {
        throw new Error('offline');
      },
    ]) {
      const controller = new WordleAlbumController(
        {
          pages: async () => {
            reads++;
            return [];
          },
        },
        check,
      );
      const res = response();
      await controller.get(
        {
          user: { id: 'user' },
          params: { guildId: 'community' },
          headers: { authorization: 'Bearer token' },
        },
        res,
      );
      expect([403, 503]).toContain(res.code);
    }
    expect(reads).toBe(0);
  });
});
