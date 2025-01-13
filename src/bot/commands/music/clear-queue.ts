import { CommandInteraction, SlashCommandBuilder } from 'discord.js';

import { isUserInVoiceChannel } from '@marquinhos/bot/validators/voice-channel';
import { SlashCommand } from '@marquinhos/types';
import { useQueue } from 'discord-player';

export const clearQueue: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName('limpar-fila')
    .setDescription('Mostra a fila de músicas'),
  validators: [isUserInVoiceChannel],
  execute: async (interaction: CommandInteraction) => {
    const queue = useQueue();

    if (!queue) {
      return interaction.reply('Não existem músicas na fila.');
    }

    queue.clear();

    return interaction.reply('A fila de músicas foi limpa.');
  },
};
