import { SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import { SlashCommand } from '../../types';


export const coin: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName('moeda')
    .setDescription('Tiro cara ou coroa numa moeda semi-viciada.'),
  execute: async (interaction) => {
    const result = ['Cara', 'Coroa'][Math.floor(Math.random() * 2)];
    const attachment = new AttachmentBuilder(`./src/resources/images/coin_${result}.png`, { name: 'result.png' });
   
    interaction.reply({
      files: [
        attachment
      ],
      content: `${result}!`
    });
  },
  cooldown: 10,
};
