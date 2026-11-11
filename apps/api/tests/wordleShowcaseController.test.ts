import { afterAll, describe, expect, it } from 'bun:test';
import { WordleShowcaseController } from '../src/modules/wordle/progression/wordle-showcase.controller';
import {
  InvalidWordleShowcase,
  WordleShowcaseService,
} from '../src/modules/wordle/progression/wordle-showcase.service';
import {
  requestController,
  startNestControllerServer,
} from './helpers/nestControllerServer';

const calls: unknown[] = [];
const server = await startNestControllerServer({
  controllers: [WordleShowcaseController],
  providers: [
    {
      provide: WordleShowcaseService,
      useValue: {
        get: async (userId: string) => {
          calls.push(userId);
          return ['one'];
        },
        replace: async (userId: string, ids: string[]) => {
          calls.push([userId, ids]);
          if (ids.includes('unowned')) {
            throw new InvalidWordleShowcase('Invalid showcase');
          }
        },
      },
    },
  ],
});
afterAll(() => server.close());

describe('Wordle showcase controller', () => {
  it('uses the authenticated identity for reading and writing', async () => {
    const read = await requestController(server, '/wordle/showcase');
    const update = await requestController(server, '/wordle/showcase', {
      method: 'PUT',
      body: { achievements: ['one'] },
    });
    expect(calls).toEqual(['owner', ['owner', ['one']]]);
    expect(read.status).toBe(200);
    expect(read.body).toEqual({ data: ['one'] });
    expect(update.status).toBe(200);
    expect(update.body).toEqual({ data: ['one'] });
  });

  it('rejects unauthenticated and invalid edits', async () => {
    const missing = await requestController(server, '/wordle/showcase', {
      method: 'PUT',
      body: { achievements: [] },
      token: '',
    });
    expect(missing.status).toBe(401);
    expect(missing.body).toEqual({ message: 'Token not provided' });

    const invalid = await requestController(server, '/wordle/showcase', {
      method: 'PUT',
      body: { achievements: ['unowned'] },
    });
    expect(invalid.status).toBe(400);
    expect(invalid.body).toEqual({ message: 'Invalid showcase' });

    const forged = await requestController(server, '/wordle/showcase', {
      method: 'PUT',
      body: { achievements: [], userId: 'other' },
    });
    expect(forged.status).toBe(400);
    expect(forged.body).toEqual({ message: 'Invalid showcase' });
  });
});
