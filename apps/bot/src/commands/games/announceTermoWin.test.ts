import type { GuessRow } from '@marquinhos/contracts/wordle';
import { expect, it } from 'bun:test';
import { Client, type GuildTextBasedChannel } from 'discord.js';
import { announceTermoWin } from './announceTermoWin';

it('celebrates a win in public without sharing its board feedback', async () => {
  const client = new Client({ intents: [] });
  const messages: unknown[] = [];
  const channel = {
    async send(message: unknown) {
      messages.push(message);
      return {};
    },
  } as unknown as GuildTextBasedChannel;
  const guesses: GuessRow[] = [{ guess: 'termo', feedback: ['correct'] }];
  const result = { attempts: 3, guesses };

  await announceTermoWin(client, channel, 'Jogador', result, {
    image: 'summary',
  });
  expect(messages).toHaveLength(1);
  expect(messages[0]).toMatchObject({
    embeds: [
      expect.objectContaining({
        data: expect.objectContaining({
          title: 'Jogador acertou em 3 tentativas!',
        }),
      }),
    ],
  });
  expect(messages[0]).toHaveProperty('files');
});
