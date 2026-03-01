import { SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '@marquinhos/types';
import { MarquinhosApiService } from '@marquinhos/services/marquinhosApi';

const marquinhosApi = new MarquinhosApiService();

export const voiceAnalyze: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName('voice-analyze')
    .setDescription(
      'Analisa sua performance vocal em tempo real durante karaokê',
    )
    .addStringOption((option) =>
      option
        .setName('session')
        .setDescription('ID da sessão de karaokê ativa')
        .setRequired(true),
    )
    .addAttachmentOption((option) =>
      option
        .setName('audio')
        .setDescription('Arquivo de áudio para análise')
        .setRequired(false),
    ),
  execute: async (interaction) => {
    if (!interaction.guildId) {
      await interaction.reply({
        content: 'Este comando só pode ser usado em um servidor.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    try {
      const sessionId = interaction.options.getString('session', true);
      const audioFile = interaction.options.getAttachment('audio');

      // Simulated audio buffer - in production would extract from attachment
      const audioBuffer = new ArrayBuffer(1024);

      const analysisData = {
        userId: interaction.user.id,
        sessionId,
        guildId: interaction.guildId,
        audioBuffer,
        referenceTrack: {
          title: 'Karaoke Track',
          artist: 'Artist',
          pitch: [440, 495, 523], // A4, B4, C5
          timing: [1.0, 0.95, 1.05],
        },
      };

      const response = await marquinhosApi.post(
        '/voice-ai/analyze',
        analysisData,
      );
      const analysis = response.data;

      const embed = interaction.client
        .baseEmbed()
        .setTitle('🎤 Análise Vocal')
        .setDescription('Resultados da análise da sua performance:')
        .addFields(
          {
            name: '🎯 Afinação',
            value: `${analysis.pitchAccuracy}%`,
            inline: true,
          },
          {
            name: '⏱️ Timing',
            value: `${analysis.timingAccuracy}%`,
            inline: true,
          },
          {
            name: '✨ Expressividade',
            value: `${analysis.expressiveness}%`,
            inline: true,
          },
          {
            name: '🏆 Pontuação Total',
            value: `**${analysis.totalScore}/100**`,
            inline: false,
          },
          {
            name: '💡 Feedback',
            value: analysis.feedback.join('\n'),
            inline: false,
          },
        )
        .setColor(
          analysis.totalScore > 80
            ? '#00FF00'
            : analysis.totalScore > 60
              ? '#FFFF00'
              : '#FF0000',
        );

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error analyzing voice:', error);
      await interaction.editReply({
        content: 'Erro ao analisar a voz. Tente novamente mais tarde.',
      });
    }
  },
  cooldown: 5,
};
