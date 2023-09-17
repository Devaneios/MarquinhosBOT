import { SlashCommandBuilder } from 'discord.js';

import { SlashCommand } from 'src/types';
import { MarquinhosApiService } from 'src/services/marquinhosApi';
import { CollageBuilder } from 'src/utils/collageBuilder';

const marquinhosApi = new MarquinhosApiService();
const collageBuilder = new CollageBuilder();

const chartsFunctions: { [key: string]: Function } = {
  artists: marquinhosApi.getTopArtists.bind(marquinhosApi),
  albums: marquinhosApi.getTopAlbums.bind(marquinhosApi),
  tracks: marquinhosApi.getTopTracks.bind(marquinhosApi),
};

const chartTypesNames: { [key: string]: string } = {
  artists: 'artistas',
  albums: 'álbuns',
  tracks: 'músicas',
};

const chartPeriodsMessages: { [key: string]: string } = {
  '7day': 'da última semana',
  '1month': 'do último mês',
  '3month': 'dos últimos 3 meses',
  '6month': 'dos últimos 6 meses',
  '12month': 'do último ano',
  overall: 'desde o início',
};

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
    await interaction.deferReply({ ephemeral: true });
    await interaction.followUp('Fiscal do Last.fm em ação! 👮‍♂️');
    const type = interaction.options.get('tipo');
    if (!type) {
      await interaction.editReply(
        'Erro de Sintonia: O bot está procurando sua batida interior. 🔍🥁'
      );
      return;
    }
    const period = interaction.options.get('periodo');
    if (!period) {
      await interaction.editReply(
        'Erro de Sintonia: O bot está procurando sua batida interior. 🔍🥁'
      );
      return;
    }

    const response = await chartsFunctions[type.value as string](
      interaction.user.id,
      period.value as string
    );

    if (!response) {
      await interaction.editReply(
        'Erro de Sintonia: O bot está procurando sua batida interior. 🔍🥁'
      );
      return;
    }

    const topList = response[type.value as string];
    const profileName = response.profileName;

    if (!topList) {
      await interaction.editReply(
        'Erro de Sintonia: O bot está procurando sua batida interior. 🔍🥁'
      );
      return;
    }

    const imagesBuffers = await collageBuilder.downloadImagesBuffers(
      topList.map((chartData: any) => chartData.coverArtUrl)
    );
    const chartNames = topList.map((chartData: any) => chartData.name);
    const images = await collageBuilder.resizeImages(imagesBuffers);
    const image = await collageBuilder.createCollage(
      images,
      chartNames,
      profileName,
      type.value as string,
      period.value as string
    );

    await interaction.channel.send({
      files: [image],
      content: `${profileName} aqui estão ${
        type.value == 'tracks' ? 'as suas' : 'os seus'
      } top ${chartTypesNames[type.value as string]} ${
        chartPeriodsMessages[period.value as string]
      }`,
    });
  },
  cooldown: 10,
};
