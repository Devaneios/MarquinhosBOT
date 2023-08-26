import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { SlashCommand } from '../../types';

export const lastfm: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName('lastfm')
    .setDescription('Mostra informações sobre a integração com o last.fm'),
  execute: (interaction) => {
    interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setThumbnail(
            'https://play-lh.googleusercontent.com/VFmAfWqcuV3aReZG8MMQdHRSdKWx85IW22f4RQ5xhR5U-o1_u03P7TVwsnTYa26Q1No'
          )
          .setDescription(
            `
        O marquinhos agora é integrado com o last.fm, para que seja possível registrar as músicas que você escuta nos bots de música.\n\n
        Entre em [Marquinhos Web](https://devaneios.guilhermeasper.dev.br:3105/login) para configurar a sua conta!
        `
          )
          .setTitle('Integração com o last.fm'),
      ],
    });
  },
  cooldown: 10,
};
