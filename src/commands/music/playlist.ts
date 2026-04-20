import { MarquinhosCommand } from '@marquinhos/lib/MarquinhosCommand';
import { MarquinhosApiService } from '@marquinhos/services/marquinhosApi';
import { Playlist, PlaylistTrack } from '@marquinhos/types';
import { baseEmbed } from '@marquinhos/utils/discord';
import { logger } from '@marquinhos/utils/logger';
import { parseArtistTitle } from '@marquinhos/utils/parser';
import { Command } from '@sapphire/framework';
import { ChatInputCommandInteraction } from 'discord.js';

const apiService = MarquinhosApiService.getInstance();

export class PlaylistCommand extends MarquinhosCommand {
  public constructor(context: Command.LoaderContext) {
    super(context, { name: 'playlist', cooldownDelay: 5_000 });
  }

  override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.commandName)
        .setDescription('Gerencia playlists do servidor')
        .addSubcommand((sub) =>
          sub
            .setName('create')
            .setDescription('Cria uma nova playlist')
            .addStringOption((opt) =>
              opt
                .setName('nome')
                .setDescription('Nome da playlist')
                .setRequired(true),
            )
            .addStringOption((opt) =>
              opt
                .setName('descricao')
                .setDescription('Descrição da playlist')
                .setRequired(false),
            )
            .addBooleanOption((opt) =>
              opt
                .setName('colaborativa')
                .setDescription('Permitir que outros adicionem músicas')
                .setRequired(false),
            ),
        )
        .addSubcommand((sub) =>
          sub.setName('list').setDescription('Lista suas playlists'),
        )
        .addSubcommand((sub) =>
          sub
            .setName('show')
            .setDescription('Mostra uma playlist específica')
            .addStringOption((opt) =>
              opt
                .setName('id')
                .setDescription('ID da playlist')
                .setRequired(true),
            ),
        )
        .addSubcommand((sub) =>
          sub
            .setName('add')
            .setDescription('Adiciona uma música à playlist')
            .addStringOption((opt) =>
              opt
                .setName('playlist')
                .setDescription('ID da playlist')
                .setRequired(true),
            )
            .addStringOption((opt) =>
              opt
                .setName('musica')
                .setDescription('Nome da música ou URL')
                .setRequired(true),
            ),
        ),
    );
  }

  override async chatInputRun(interaction: ChatInputCommandInteraction) {
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
          await handleCreatePlaylist(this, interaction, userId, guildId);
          break;
        case 'list':
          await handleListPlaylists(this, interaction, userId, guildId);
          break;
        case 'show':
          await handleShowPlaylist(this, interaction);
          break;
        case 'add':
          await handleAddToPlaylist(this, interaction, userId);
          break;
      }
    } catch (error) {
      logger.error('Error in playlist command:', error);
      await interaction.editReply('Ocorreu um erro ao executar o comando.');
    }
  }
}

async function handleCreatePlaylist(
  cmd: PlaylistCommand,
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
    const embed = baseEmbed(cmd.container.client)
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
  cmd: PlaylistCommand,
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
    const embed = baseEmbed(cmd.container.client)
      .setTitle('🎵 Suas Playlists')
      .setDescription(
        result.data
          .map(
            (p: Playlist, index: number) =>
              `**${index + 1}.** ${p.name} (${p.tracks.length} músicas)\nID: \`${p.id}\`\n${p.isCollaborative ? '👥 Colaborativa' : '👤 Privada'}`,
          )
          .join('\n\n'),
      );
    await interaction.editReply({ embeds: [embed] });
  } catch (_error) {
    await interaction.editReply('Erro ao buscar playlists.');
  }
}

async function handleShowPlaylist(
  cmd: PlaylistCommand,
  interaction: ChatInputCommandInteraction,
) {
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
              (t: PlaylistTrack, i: number) =>
                `**${i + 1}.** ${t.artist} - ${t.title} (${t.votes} votos)`,
            )
            .join('\n')
        : 'Nenhuma música na playlist';
    const embed = baseEmbed(cmd.container.client)
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
    if (playlist.tracks.length > 10)
      embed.setFooter({
        text: `Mostrando 10 de ${playlist.tracks.length} músicas`,
      });
    await interaction.editReply({ embeds: [embed] });
  } catch (_error) {
    await interaction.editReply('Erro ao buscar playlist.');
  }
}

async function handleAddToPlaylist(
  cmd: PlaylistCommand,
  interaction: ChatInputCommandInteraction,
  userId: string,
) {
  const playlistId = interaction.options.getString('playlist', true);
  const musicQuery = interaction.options.getString('musica', true);
  let track: { title: string; artist: string; url: string };
  if (musicQuery.includes('http')) {
    track = {
      title: 'Música da URL',
      artist: 'Artista Desconhecido',
      url: musicQuery,
    };
  } else {
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
    const embed = baseEmbed(cmd.container.client)
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
