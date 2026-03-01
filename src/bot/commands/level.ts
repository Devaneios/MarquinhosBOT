import { MarquinhosApiService } from '@marquinhos/services/marquinhosApi';
import { SlashCommand } from '@marquinhos/types';
import { SlashCommandBuilder } from 'discord.js';

const apiService = new MarquinhosApiService();

export const level: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName('level')
    .setDescription('Mostra seu nível e XP atual')
    .addUserOption((option) =>
      option
        .setName('usuario')
        .setDescription('Usuário para verificar o nível (opcional)')
        .setRequired(false),
    ),
  execute: async (interaction) => {
    await interaction.deferReply();

    const targetUser =
      interaction.options.getUser('usuario') || interaction.user;
    const userId = targetUser.id;
    const guildId = interaction.guildId;

    if (!guildId) {
      await interaction.editReply(
        'Este comando só pode ser usado em servidores!',
      );
      return;
    }

    try {
      const userLevel = await apiService.getUserLevel(userId, guildId);

      if (!userLevel?.data) {
        await interaction.editReply(
          `${targetUser.username} ainda não possui níveis registrados.`,
        );
        return;
      }

      const { level, xp, totalXp } = userLevel.data;
      const requiredXP = Math.floor(Math.pow(level + 1, 2) * 100);
      const progressPercentage = Math.floor((xp / requiredXP) * 100);

      const progressBar = createProgressBar(progressPercentage);

      const embed = interaction.client
        .baseEmbed()
        .setTitle(`📊 Nível de ${targetUser.username}`)
        .setThumbnail(targetUser.displayAvatarURL())
        .addFields(
          { name: '🏆 Nível', value: level.toString(), inline: true },
          { name: '⚡ XP Atual', value: `${xp}/${requiredXP}`, inline: true },
          { name: '📈 XP Total', value: totalXp.toString(), inline: true },
          {
            name: '📊 Progresso',
            value: `${progressBar} ${progressPercentage}%`,
            inline: false,
          },
        );

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error fetching user level:', error);
      await interaction.editReply(
        'Ocorreu um erro ao buscar as informações de nível.',
      );
    }
  },
  cooldown: 10,
};

function createProgressBar(percentage: number): string {
  const filled = Math.floor(percentage / 10);
  const empty = 10 - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}
