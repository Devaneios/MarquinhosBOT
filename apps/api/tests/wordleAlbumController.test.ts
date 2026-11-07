import { afterAll, expect, it } from 'bun:test';
import { WordleAlbumController } from '../src/modules/wordle/controllers/wordle-album.controller';
import { WordleAlbumService } from '../src/modules/wordle/services/wordle-album.service';
import {
  requestController,
  startNestControllerServer,
} from './helpers/nestControllerServer';

const calls: string[] = [];
const serverPromise = startNestControllerServer({
  controllers: [WordleAlbumController],
  providers: [
    {
      provide: WordleAlbumService,
      useValue: {
        pages: async (guild: string) => {
          calls.push(guild);
          return [];
        },
      },
    },
  ],
});
const server = await serverPromise;
afterAll(() => server.close());

it('returns the album of the requested community', async () => {
  const response = await requestController(server, '/wordle/album/community');
  expect(calls).toEqual(['community']);
  expect(response.status).toBe(200);
  expect(response.body).toEqual({ data: [] });
});
