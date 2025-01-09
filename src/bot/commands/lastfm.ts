import { SlashCommandBuilder } from 'discord.js';
import dotenv from 'dotenv';

import { SlashCommand } from '@marquinhos/types';

dotenv.config();

export const lastfm: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName('lastfm')
    .setDescription('Mostra informações sobre a integração com o last.fm'),
  execute: (interaction) => {
    const lastfmEmbed = interaction.client.baseEmbed();
    interaction.reply({
      embeds: [
        lastfmEmbed
          .setThumbnail(
            'https://play-lh.googleusercontent.com/VFmAfWqcuV3aReZG8MMQdHRSdKWx85IW22f4RQ5xhR5U-o1_u03P7TVwsnTYa26Q1No'
          )
          .setDescription(
            `
        O marquinhos agora é integrado com o last.fm, para que seja possível registrar as músicas que você escuta nos bots de música.\n\n
        Entre em [Marquinhos Web](${process.env.MARQUINHOS_WEB_URL}) para configurar a sua conta!
        `
          )
          .setTitle('Integração com o last.fm'),
      ],
    });
  },
  cooldown: 10,
};
