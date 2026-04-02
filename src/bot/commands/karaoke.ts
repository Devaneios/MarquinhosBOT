import { SlashCommand } from '@marquinhos/types';
import { HttpClient } from '@marquinhos/utils/httpClient';
import { parseArtistTitle } from '@marquinhos/utils/parser';
import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';

const httpClient = new HttpClient({
  baseURL: process.env.MARQUINHOS_API_URL,
  headers: {
    Authorization: `Bearer ${process.env.MARQUINHOS_API_KEY}`,
  },
  retries: 2,
});

export const karaoke: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName('karaoke')
    .setDescription('Sistema de karaokê')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('start')
        .setDescription('Inicia uma sessão de karaokê'),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('join')
        .setDescription('Entra na sessão de karaokê ativa'),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('song')
        .setDescription('Define a música atual do karaokê')
        .addStringOption((option) =>
          option
            .setName('musica')
            .setDescription('Nome da música')
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('score')
        .setDescription('Mostra o ranking da sessão atual'),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('end').setDescription('Encerra a sessão de karaokê'),
    ),
  execute: async (interaction) => {
    await interaction.deferReply();

    const subcommand = interaction.options.getSubcommand();
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const channelId = interaction.channelId;

    if (!guildId) {
      await interaction.editReply(
        'Este comando só pode ser usado em servidores!',
      );
      return;
    }

    try {
      switch (subcommand) {
        case 'start':
          await handleStartKaraoke(interaction, userId, guildId, channelId);
          break;
        case 'join':
          await handleJoinKaraoke(interaction, userId, guildId, channelId);
          break;
        case 'song':
          await handleSetSong(interaction, userId);
          break;
        case 'score':
          await handleShowScore(interaction, guildId, channelId);
          break;
        case 'end':
          await handleEndKaraoke(interaction, userId, guildId, channelId);
          break;
      }
    } catch (error) {
      console.error('Error in karaoke command:', error);
      await interaction.editReply('Ocorreu um erro no karaokê.');
    }
  },
  cooldown: 5,
};

async function handleStartKaraoke(
  interaction: ChatInputCommandInteraction,
  userId: string,
  guildId: string,
  channelId: string,
) {
  try {
    await httpClient.post('/api/karaoke/session', {
      guildId,
      channelId,
      hostId: userId,
    });

    const embed = interaction.client
      .baseEmbed()
      .setTitle('🎤 Sessão de Karaokê Iniciada!')
      .setDescription('Use `/karaoke join` para participar!')
      .addFields(
        { name: 'Host', value: `<@${userId}>`, inline: true },
        { name: 'Participantes', value: '1', inline: true },
      );

    await interaction.editReply({ embeds: [embed] });
  } catch (_error) {
    await interaction.editReply('Erro ao iniciar sessão de karaokê.');
  }
}

async function handleJoinKaraoke(
  interaction: ChatInputCommandInteraction,
  userId: string,
  guildId: string,
  channelId: string,
) {
  try {
    // Get active session
    const sessionData = (await httpClient.get(
      `/api/karaoke/active/${guildId}/${channelId}`,
    )) as { data: { id: string } };

    if (!sessionData?.data) {
      await interaction.editReply(
        'Nenhuma sessão de karaokê ativa neste canal.',
      );
      return;
    }

    // Join session
    await httpClient.post(`/api/karaoke/session/${sessionData.data.id}/join`, {
      userId,
    });

    await interaction.editReply(
      `🎤 ${interaction.user.username} entrou no karaokê!`,
    );
  } catch (_error) {
    await interaction.editReply('Erro ao entrar na sessão.');
  }
}

async function handleSetSong(
  interaction: ChatInputCommandInteraction,
  _userId: string,
) {
  const musicQuery = interaction.options.getString('musica');

  // Parse artist and title
  const track = parseArtistTitle(musicQuery);

  await interaction.editReply(
    `🎵 Música definida: **${track.artist} - ${track.title}**\nComece a cantar!`,
  );
}

async function handleShowScore(
  interaction: ChatInputCommandInteraction,
  guildId: string,
  channelId: string,
) {
  try {
    const sessionData = (await httpClient.get(
      `/api/karaoke/active/${guildId}/${channelId}`,
    )) as { data: { participants: unknown[] } };

    if (!sessionData?.data) {
      await interaction.editReply(
        'Nenhuma sessão ativa para mostrar pontuação.',
      );
      return;
    }

    const embed = interaction.client
      .baseEmbed()
      .setTitle('🏆 Ranking do Karaokê')
      .setDescription('Pontuações da sessão atual')
      .addFields({
        name: 'Participantes',
        value: sessionData.data.participants.length.toString(),
        inline: true,
      });

    await interaction.editReply({ embeds: [embed] });
  } catch (_error) {
    await interaction.editReply('Erro ao buscar pontuações.');
  }
}

async function handleEndKaraoke(
  interaction: ChatInputCommandInteraction,
  _userId: string,
  _guildId: string,
  _channelId: string,
) {
  await interaction.editReply(
    '🎤 Sessão de karaokê encerrada! Obrigado por participar!',
  );
}
