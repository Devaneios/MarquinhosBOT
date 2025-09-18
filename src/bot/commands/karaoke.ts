import { SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '@marquinhos/types';
import axios from 'axios';

export const karaoke: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName('karaoke')
    .setDescription('Sistema de karaokê')
    .addSubcommand(subcommand =>
      subcommand
        .setName('start')
        .setDescription('Inicia uma sessão de karaokê')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('join')
        .setDescription('Entra na sessão de karaokê ativa')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('song')
        .setDescription('Define a música atual do karaokê')
        .addStringOption(option =>
          option
            .setName('musica')
            .setDescription('Nome da música')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('score')
        .setDescription('Mostra o ranking da sessão atual')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('end')
        .setDescription('Encerra a sessão de karaokê')
    ),
  execute: async (interaction) => {
    await interaction.deferReply();
    
    const subcommand = interaction.options.getSubcommand();
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const channelId = interaction.channelId;
    
    if (!guildId) {
      await interaction.editReply('Este comando só pode ser usado em servidores!');
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

async function handleStartKaraoke(interaction: any, userId: string, guildId: string, channelId: string) {
  try {
    const response = await axios.post(
      `${process.env.MARQUINHOS_API_URL}/api/karaoke/session`,
      { guildId, channelId, hostId: userId },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.MARQUINHOS_API_KEY}`,
        },
      }
    );

    const embed = interaction.client.baseEmbed()
      .setTitle('🎤 Sessão de Karaokê Iniciada!')
      .setDescription('Use `/karaoke join` para participar!')
      .addFields(
        { name: 'Host', value: `<@${userId}>`, inline: true },
        { name: 'Participantes', value: '1', inline: true }
      );

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    await interaction.editReply('Erro ao iniciar sessão de karaokê.');
  }
}

async function handleJoinKaraoke(interaction: any, userId: string, guildId: string, channelId: string) {
  try {
    // Get active session
    const sessionResponse = await axios.get(
      `${process.env.MARQUINHOS_API_URL}/api/karaoke/active/${guildId}/${channelId}`,
      {
        headers: { Authorization: `Bearer ${process.env.MARQUINHOS_API_KEY}` },
      }
    );

    if (!sessionResponse.data.data) {
      await interaction.editReply('Nenhuma sessão de karaokê ativa neste canal.');
      return;
    }

    // Join session
    await axios.post(
      `${process.env.MARQUINHOS_API_URL}/api/karaoke/session/${sessionResponse.data.data.id}/join`,
      { userId },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.MARQUINHOS_API_KEY}`,
        },
      }
    );

    await interaction.editReply(`🎤 ${interaction.user.username} entrou no karaokê!`);
  } catch (error) {
    await interaction.editReply('Erro ao entrar na sessão.');
  }
}

async function handleSetSong(interaction: any, userId: string) {
  const musicQuery = interaction.options.getString('musica');
  
  // Parse artist and title
  const parts = musicQuery.split(' - ');
  const track = {
    title: parts.length > 1 ? parts[1] : musicQuery,
    artist: parts.length > 1 ? parts[0] : 'Artista Desconhecido'
  };

  await interaction.editReply(`🎵 Música definida: **${track.artist} - ${track.title}**\nComece a cantar!`);
}

async function handleShowScore(interaction: any, guildId: string, channelId: string) {
  try {
    const sessionResponse = await axios.get(
      `${process.env.MARQUINHOS_API_URL}/api/karaoke/active/${guildId}/${channelId}`,
      {
        headers: { Authorization: `Bearer ${process.env.MARQUINHOS_API_KEY}` },
      }
    );

    if (!sessionResponse.data.data) {
      await interaction.editReply('Nenhuma sessão ativa para mostrar pontuação.');
      return;
    }

    const embed = interaction.client.baseEmbed()
      .setTitle('🏆 Ranking do Karaokê')
      .setDescription('Pontuações da sessão atual')
      .addFields(
        { name: 'Participantes', value: sessionResponse.data.data.participants.length.toString(), inline: true }
      );

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    await interaction.editReply('Erro ao buscar pontuações.');
  }
}

async function handleEndKaraoke(interaction: any, userId: string, guildId: string, channelId: string) {
  await interaction.editReply('🎤 Sessão de karaokê encerrada! Obrigado por participar!');
}
