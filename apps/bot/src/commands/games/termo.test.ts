import { describe, expect, it, mock } from 'bun:test';
import type { AutocompleteInteraction } from 'discord.js';

process.env.MARQUINHOS_TOKEN = 'test-token';
process.env.MARQUINHOS_CLIENT_ID = 'test-client';

const writes: unknown[][] = [];
const apiStub = {
  getWordleStats: async () => ({
    data: { wordDate: '2026-10-29', wordLength: 5 },
  }),
  getUserWordleSession: async () => ({ data: null }),
  writeWordleDraft: async (...args: unknown[]) => {
    writes.push(args.slice(0, 3));
    return { data: { status: 'saved' } };
  },
  validateWordleGuess: async () => ({ data: { valid: true } }),
};

mock.module('@marquinhos/services/marquinhosApi', () => ({
  MarquinhosApiService: { getInstance: () => apiStub },
}));
mock.module('@marquinhos/config/developmentScope', () => ({
  isDevelopmentChannelAllowed: () => true,
}));

const { TermoCommand } = await import('./termo');

describe('Termo draft autocomplete', () => {
  it('stores the input delivered by autocomplete, including short and cleared values', async () => {
    writes.length = 0;
    const responses: unknown[][] = [];
    const command = Object.create(TermoCommand.prototype) as {
      autocompleteRun: (
        interaction: AutocompleteInteraction,
      ) => Promise<unknown>;
    };
    const interaction = (focused: string) =>
      ({
        guildId: 'guild-1',
        user: { id: 'user-1' },
        options: { getFocused: () => focused },
        respond: async (choices: unknown[]) => {
          responses.push(choices);
        },
      }) as unknown as AutocompleteInteraction;

    await command.autocompleteRun(interaction('te'));
    await command.autocompleteRun(interaction(''));

    expect(writes).toEqual([
      [
        'user-1',
        'guild-1',
        {
          date: '2026-10-29',
          rowIndex: 0,
          cells: ['t', 'e', '', '', ''],
          activeIndex: 2,
        },
      ],
      [
        'user-1',
        'guild-1',
        {
          date: '2026-10-29',
          rowIndex: 0,
          cells: ['', '', '', '', ''],
          activeIndex: 0,
        },
      ],
    ]);
    expect(responses).toEqual([[], []]);
  });

  it('does not turn an oversized entry into a winning prefix', async () => {
    writes.length = 0;
    const command = Object.create(TermoCommand.prototype) as {
      autocompleteRun: (
        interaction: AutocompleteInteraction,
      ) => Promise<unknown>;
    };
    const interaction = {
      guildId: 'guild-1',
      user: { id: 'user-1' },
      options: { getFocused: () => 'termos' },
      respond: async () => undefined,
    } as unknown as AutocompleteInteraction;

    await command.autocompleteRun(interaction);

    expect(writes[0]?.[2]).toMatchObject({
      cells: ['t', 'e', 'r', 'm', ''],
    });
  });

  it('keeps the newest delivered autocomplete edit when older reads finish later', async () => {
    writes.length = 0;
    const originalGetWordleStats = apiStub.getWordleStats;
    let releaseOlderRead:
      | ((value: { data: { wordDate: string; wordLength: number } }) => void)
      | undefined;
    let readCount = 0;
    apiStub.getWordleStats = () => {
      readCount += 1;
      if (readCount === 1)
        return new Promise((resolve) => {
          releaseOlderRead = resolve;
        });
      return Promise.resolve({
        data: { wordDate: '2026-10-29', wordLength: 5 },
      });
    };
    const command = Object.create(TermoCommand.prototype) as {
      autocompleteRun: (
        interaction: AutocompleteInteraction,
      ) => Promise<unknown>;
    };
    const interaction = (focused: string) =>
      ({
        guildId: 'guild-1',
        user: { id: 'user-1' },
        options: { getFocused: () => focused },
        respond: async () => undefined,
      }) as unknown as AutocompleteInteraction;

    try {
      const older = command.autocompleteRun(interaction('termo'));
      const newer = command.autocompleteRun(interaction(''));
      await newer;
      releaseOlderRead?.({
        data: { wordDate: '2026-10-29', wordLength: 5 },
      });
      await older;

      expect(writes).toEqual([
        [
          'user-1',
          'guild-1',
          {
            date: '2026-10-29',
            rowIndex: 0,
            cells: ['', '', '', '', ''],
            activeIndex: 0,
          },
        ],
      ]);
    } finally {
      apiStub.getWordleStats = originalGetWordleStats;
    }
  });
});
