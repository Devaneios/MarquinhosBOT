import { SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '../../types';
import ArrestedModel from '../../schemas/arrested';

export const arrested: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName('encarcerados')
    .setDescription('Te dou uma lista de quem tá preso'),
  execute: async (interaction) => {
    const arrested = await (await getArrested()).toArray();

  },
  cooldown: 10,
};

async function getArrested() {
  return ArrestedModel.collection.find();
}
