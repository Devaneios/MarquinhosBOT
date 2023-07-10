import { SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '../../types';
import { join } from 'path';

export const horse: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName('cavalo')
    .setDescription('CAVALO'),
  execute: async (interaction) => {
    interaction.reply({
        files: [
          {
            attachment: join(__dirname, '../../resources/animations/cavalo.gif'),
            name: 'cavalo.gif',
            description: 'CAVALO',
          },
        ],
      });
  },
  cooldown: 10,
};
