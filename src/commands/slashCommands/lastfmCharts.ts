import { SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import { SlashCommand } from '../../types';
import { MarquinhosApiService } from '../../services/marquinhosApi';
import { CollageService } from '../../services/collage';

const marquinhosApi = new MarquinhosApiService();
const collageService = new CollageService();

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
    const type = interaction.options.get('tipo');
    if (!type) {
      await interaction.editReply('Something went wrong!');
      return;
    }
    const period = interaction.options.get('periodo');
    if (!period) {
      await interaction.editReply('Something went wrong!');
      return;
    }

    const response = await chartsFunctions[type.value as string](
      interaction.user.id,
      period
    );
    if (!response) {
      await interaction.editReply('Something went wrong!');
      return;
    }

    const imagesBuffers = await collageService.downloadImagesBuffers(
      response.map((chartData: any) => chartData.coverArtUrl)
    );
    const chartNames = response.map((chartData: any) => chartData.name);
    const images = await collageService.resizeImages(imagesBuffers);
    const image = await collageService.createCollage(
      images,
      chartNames,
      interaction.user.username,
      type.value as string
    );

    await interaction.channel.send({
      files: [image],
      content: `${interaction.user.username} aqui estão ${
        type.value == 'tracks' ? 'as suas' : 'os seus'
      } top ${chartTypesNames[type.value as string]} do Last.fm`,
    });

    await interaction.editReply('Done!');
  },
  cooldown: 10,
};
