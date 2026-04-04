import { MarquinhosApiService } from '@marquinhos/services/marquinhosApi';
import { Playlist, PlaylistTrack, SlashCommand } from '@marquinhos/types';
import { parseArtistTitle } from '@marquinhos/utils/parser';
import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';

const apiService = MarquinhosApiService.getInstance();

export const playlist: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName('playlist')
    .setDescription('Gerencia playlists do servidor')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('create')
        .setDescription('Cria uma nova playlist')
        .addStringOption((option) =>
          option
            .setName('nome')
            .setDescription('Nome da playlist')
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName('descricao')
            .setDescription('Descrição da playlist')
            .setRequired(false),
        )
        .addBooleanOption((option) =>
          option
            .setName('colaborativa')
            .setDescription('Permitir que outros usuários adicionem músicas')
            .setRequired(false),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('list').setDescription('Lista suas playlists'),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('show')
        .setDescription('Mostra uma playlist específica')
        .addStringOption((option) =>
          option
            .setName('id')
            .setDescription('ID da playlist')
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('add')
        .setDescription('Adiciona uma música à playlist')
        .addStringOption((option) =>
          option
            .setName('playlist')
            .setDescription('ID da playlist')
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName('musica')
            .setDescription('Nome da música ou URL')
            .setRequired(true),
        ),
    ),
  execute: async (interaction) => {
    await interaction.deferReply();

    const subcommand = interaction.options.getSubcommand();
    const userId = interaction.user.id;
    const guildId = interaction.guildId;

    if (!guildId) {
      await interaction.editReply(
        'Este comando só pode ser usado em servidores!',
      );
      return;
    }

    try {
      switch (subcommand) {
        case 'create':
          await handleCreatePlaylist(interaction, userId, guildId);
          break;
        case 'list':
          await handleListPlaylists(interaction, userId, guildId);
          break;
        case 'show':
          await handleShowPlaylist(interaction);
          break;
        case 'add':
          await handleAddToPlaylist(interaction, userId);
          break;
        default:
          await interaction.editReply('Subcomando não reconhecido.');
      }
    } catch (error) {
      console.error('Error in playlist command:', error);
      await interaction.editReply('Ocorreu um erro ao executar o comando.');
    }
  },
  cooldown: 5,
};

async function handleCreatePlaylist(
  interaction: ChatInputCommandInteraction,
  userId: string,
  guildId: string,
) {
  const name = interaction.options.getString('nome', true);
  const description = interaction.options.getString('descricao') || '';
  const isCollaborative =
    interaction.options.getBoolean('colaborativa') || false;

  try {
    const result = await apiService.createPlaylist(
      name,
      description,
      userId,
      guildId,
      isCollaborative,
    );

    const embed = interaction.client
      .baseEmbed()
      .setTitle('🎵 Playlist Criada!')
      .setDescription(`**${name}**\n${description}`)
      .addFields(
        { name: 'ID', value: result.data.id, inline: true },
        {
          name: 'Colaborativa',
          value: isCollaborative ? 'Sim' : 'Não',
          inline: true,
        },
        { name: 'Músicas', value: '0', inline: true },
      );

    await interaction.editReply({ embeds: [embed] });
  } catch (_error) {
    await interaction.editReply('Erro ao criar playlist. Tente novamente.');
  }
}

async function handleListPlaylists(
  interaction: ChatInputCommandInteraction,
  userId: string,
  guildId: string,
) {
  try {
    const result = await apiService.getUserPlaylists(userId, guildId);

    if (!result.data || result.data.length === 0) {
      await interaction.editReply('Você não possui playlists.');
      return;
    }

    const embed = interaction.client
      .baseEmbed()
      .setTitle('🎵 Suas Playlists')
      .setDescription(
        result.data
          .map(
            (playlist: Playlist, index: number) =>
              `**${index + 1}.** ${playlist.name} (${playlist.tracks.length} músicas)\n` +
              `ID: \`${playlist.id}\`\n` +
              `${playlist.isCollaborative ? '👥 Colaborativa' : '👤 Privada'}`,
          )
          .join('\n\n'),
      );

    await interaction.editReply({ embeds: [embed] });
  } catch (_error) {
    await interaction.editReply('Erro ao buscar playlists.');
  }
}

async function handleShowPlaylist(interaction: ChatInputCommandInteraction) {
  const playlistId = interaction.options.getString('id', true);

  try {
    const result = await apiService.getPlaylist(playlistId);

    if (!result.data) {
      await interaction.editReply('Playlist não encontrada.');
      return;
    }

    const playlist = result.data;
    const tracksText =
      playlist.tracks.length > 0
        ? playlist.tracks
            .slice(0, 10)
            .map(
              (track: PlaylistTrack, index: number) =>
                `**${index + 1}.** ${track.artist} - ${track.title} (${track.votes} votos)`,
            )
            .join('\n')
        : 'Nenhuma música na playlist';

    const embed = interaction.client
      .baseEmbed()
      .setTitle(`🎵 ${playlist.name}`)
      .setDescription(playlist.description || 'Sem descrição')
      .addFields(
        { name: 'Músicas', value: tracksText, inline: false },
        {
          name: 'Total de Músicas',
          value: playlist.tracks.length.toString(),
          inline: true,
        },
        {
          name: 'Seguidores',
          value: playlist.followers.length.toString(),
          inline: true,
        },
        {
          name: 'Colaborativa',
          value: playlist.isCollaborative ? 'Sim' : 'Não',
          inline: true,
        },
      );

    if (playlist.tracks.length > 10) {
      embed.setFooter({
        text: `Mostrando 10 de ${playlist.tracks.length} músicas`,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (_error) {
    await interaction.editReply('Erro ao buscar playlist.');
  }
}

async function handleAddToPlaylist(
  interaction: ChatInputCommandInteraction,
  userId: string,
) {
  const playlistId = interaction.options.getString('playlist', true);
  const musicQuery = interaction.options.getString('musica', true);

  // Parse music info (simplified)
  let track: { title: string; artist: string; url: string };
  if (musicQuery.includes('http')) {
    // URL provided
    track = {
      title: 'Música da URL',
      artist: 'Artista Desconhecido',
      url: musicQuery,
    };
  } else {
    // Search query provided
    const parsed = parseArtistTitle(musicQuery);
    track = {
      title: parsed.title,
      artist: parsed.artist,
      url: `https://example.com/search?q=${encodeURIComponent(musicQuery)}`,
    };
  }

  try {
    const result = await apiService.addTrackToPlaylist(
      playlistId,
      userId,
      track,
    );

    if (!result.data) {
      await interaction.editReply('Playlist não encontrada.');
      return;
    }

    const embed = interaction.client
      .baseEmbed()
      .setTitle('✅ Música Adicionada!')
      .setDescription(
        `**${track.artist} - ${track.title}**\nfoi adicionada à playlist **${result.data.name}**`,
      )
      .addFields({
        name: 'Total de Músicas',
        value: result.data.tracks.length.toString(),
        inline: true,
      });

    await interaction.editReply({ embeds: [embed] });
  } catch (error: unknown) {
    if (
      (error as { response?: { status?: number } })?.response?.status === 403
    ) {
      await interaction.editReply(
        'Você não tem permissão para adicionar músicas a esta playlist.',
      );
    } else {
      await interaction.editReply('Erro ao adicionar música à playlist.');
    }
  }
}
