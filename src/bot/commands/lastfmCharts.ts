import { SlashCommandBuilder } from 'discord.js';

import { SlashCommand } from '@marquinhos/types';


export const lastfmCharts: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName('lastfm-charts')
    .setDescription(
      'Mostra o top de artistas, álbuns ou músicas de um usuário do Last.fm'
    )
    .addStringOption((option) =>
      option
        .setName('tipo')
        .setDescription('O tipo do top list')
        .setRequired(true)
        .addChoices(
          { name: 'artistas', value: 'artists' },
          { name: 'álbuns', value: 'albums' },
          { name: 'músicas', value: 'tracks' }
        )
    )
    .addStringOption((option) =>
      option
        .setName('periodo')
        .setDescription('O período do top list')
        .setRequired(true)
        .addChoices(
          { name: 'Última semana', value: '7day' },
          { name: 'Último mês', value: '1month' },
          { name: 'Últimos 3 meses', value: '3month' },
          { name: 'Últimos 6 meses', value: '6month' },
          { name: 'Último ano', value: '12month' },
          { name: 'Desde o início', value: 'overall' }
        )
    ),
  execute: async (interaction) => {
    interaction.reply('Feature temporariamente desabilitada');
  },
  cooldown: 10,
};
