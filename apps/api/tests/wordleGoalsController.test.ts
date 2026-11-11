import { afterAll, expect, it } from 'bun:test';
import { WordleGoalsController } from '../src/modules/wordle/community/wordle-goals.controller';
import { WordleGoalsService } from '../src/modules/wordle/community/wordle-goals.service';
import {
  requestController,
  startNestControllerServer,
} from './helpers/nestControllerServer';

const calls: string[] = [];
const server = await startNestControllerServer({
  controllers: [WordleGoalsController],
  providers: [
    {
      provide: WordleGoalsService,
      useValue: {
        listWithProgress: async (guildId: string) => {
          calls.push(guildId);
          return [];
        },
        createForDates: async () => {
          throw new Error('not used');
        },
      },
    },
  ],
});
afterAll(() => server.close());

it('lists the progress of the requested community', async () => {
  const response = await requestController(server, '/wordle/goals/a');
  expect(calls).toEqual(['a']);
  expect(response.status).toBe(200);
  expect(response.body).toEqual({ data: [] });
});
