import { expect, mock, test } from 'bun:test';
import { ApplicationCommandType, Routes, type REST } from 'discord.js';
import { preserveActivityEntryPoint } from '../src/lib/preserveActivityEntryPoint';

test('preserves the Activity entry point when overwriting global commands', async () => {
  const slash = { type: ApplicationCommandType.ChatInput, name: 'termo' };
  const entryPoint = {
    id: '456',
    name: 'launch',
    description: 'Launch the Activity',
    type: ApplicationCommandType.PrimaryEntryPoint,
    handler: 2,
    contexts: [0, 1, 2],
    integration_types: [0, 1],
    name_localizations: { 'pt-BR': 'jogar' },
  };
  const put = mock<REST['put']>(async () => [slash, entryPoint]);
  const get = mock<REST['get']>(async () => [entryPoint]);
  const rest = { get, put };
  const route = Routes.applicationCommands('123');
  preserveActivityEntryPoint(rest, '123');

  expect(await rest.put(route, { body: [slash] })).toEqual([slash]);
  expect(get).toHaveBeenCalledWith(route, {
    query: new URLSearchParams({ with_localizations: 'true' }),
  });
  const { id: _id, ...writableEntryPoint } = entryPoint;
  expect(put).toHaveBeenCalledWith(route, {
    body: [slash, expect.objectContaining(writableEntryPoint)],
  });
});
