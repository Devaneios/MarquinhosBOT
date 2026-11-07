import { afterAll, describe, expect, it } from 'bun:test';
import { WordleUserConfigController } from '../src/modules/wordle/controllers/wordle-user-config.controller';
import { WordleUserConfigService } from '../src/modules/wordle/wordle-user-config.service';
import {
  requestController,
  startNestControllerServer,
} from './helpers/nestControllerServer';

const calls: unknown[] = [];
const server = await startNestControllerServer({
  controllers: [WordleUserConfigController],
  providers: [
    {
      provide: WordleUserConfigService,
      useValue: {
        get: async () => ({
          invertActionKeys: false,
          enableSounds: true,
          enableSpaceKey: true,
          enableArrowKeys: false,
        }),
        update: async (userId: string, config: unknown) => {
          calls.push({ userId, config });
          return config;
        },
      },
    },
  ],
});
afterAll(() => server.close());

describe('Wordle user config controller', () => {
  it('returns only the authenticated user config', async () => {
    const response = await requestController(server, '/wordle/user-config');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: {
        invertActionKeys: false,
        enableSounds: true,
        enableSpaceKey: true,
        enableArrowKeys: false,
      },
    });
  });

  it('replaces the authenticated user config when all fields are valid', async () => {
    const config = {
      invertActionKeys: true,
      enableSounds: false,
      enableSpaceKey: true,
      enableArrowKeys: true,
    };
    const response = await requestController(server, '/wordle/user-config', {
      method: 'PUT',
      body: config,
    });
    expect(calls).toEqual([{ userId: 'owner', config }]);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: config });
  });

  it('rejects partial and non-boolean configurations', async () => {
    for (const body of [
      { invertActionKeys: true },
      { invertActionKeys: true, enableSounds: 'yes' },
      {
        invertActionKeys: false,
        enableSounds: false,
        enableSpaceKey: false,
        enableArrowKeys: true,
      },
      null,
    ]) {
      const response = await requestController(server, '/wordle/user-config', {
        method: 'PUT',
        body,
      });
      expect(response.status).toBe(400);
    }
  });
});
