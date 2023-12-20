import { SlashCommandBuilder } from 'discord.js';

import { SlashCommand } from '@marquinhos/types';
import { join } from 'path';

export const esroh: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName('olavac')
    .setDescription('Oirártnoc?'),
  execute: async (interaction) => {
    interaction.reply({
      files: [
        {
          attachment: join(
            __dirname,
            '../../../resources/animations/olavac.gif'
          ),
          name: 'olavac.gif',
          description: 'CONTRARIO',
        },
      ],
    });
  },
  cooldown: 10,
};
