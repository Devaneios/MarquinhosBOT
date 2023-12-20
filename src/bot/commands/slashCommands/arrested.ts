import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';

import { SlashCommand } from '@marquinhos/types';
import ArrestedModel from '@schemas/arrested';

export const arrested: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName('encarcerados')
    .setDescription('Te dou uma lista de quem tá preso'),
  execute: async (interaction) => {
    const arrested = await (await getArrested()).toArray();
    interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setDescription(
            arrested
              .map((a) => a.user)
              .toString()
              .replace(',', '\n')
          )
          .setTitle('Segue lista dos criminosos:'),
      ],
    });
  },
  cooldown: 10,
};

async function getArrested() {
  return ArrestedModel.collection.find();
}
