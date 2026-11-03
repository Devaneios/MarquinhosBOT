import { expect, it } from 'bun:test';
import { WordleAlbumController } from '../src/controllers/wordleAlbum.controller';

it('returns the album of the requested community', async () => {
  const calls: string[] = [];
  const controller = new WordleAlbumController({
    pages: async (guild) => {
      calls.push(guild);
      return [];
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
  await controller.get('community', res);
  expect(calls).toEqual(['community']);
  expect(res.body).toEqual({ data: [] });
});
