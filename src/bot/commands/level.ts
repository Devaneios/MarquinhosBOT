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
      const badge = getBadgeForLevel(level);
      const color = getColorForLevel(level);

      const embed = interaction.client
        .baseEmbed()
        .setColor(color)
        .setAuthor({
          name: targetUser.username,
          iconURL: targetUser.displayAvatarURL(),
        })
        .setTitle(`🌟 Cartão de Nível`)
        .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
        .setDescription(
          `**Cargo Atual:** ${badge}\n\n` +
            `**Nível:** \`${level}\`\n` +
            `**Experiência:** \`${xp} / ${requiredXP} XP\`\n\n` +
            `**Progresso:**\n` +
            `${progressBar} \`${progressPercentage}%\`\n\n` +
            `*XP Total Acumulado: ${totalXp}*`,
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
  return '🟩'.repeat(filled) + '⬛'.repeat(empty);
}

function getBadgeForLevel(level: number): string {
  if (level < 10) return '🌱 Iniciante';
  if (level < 20) return '🥉 Aventureiro de Bronze';
  if (level < 30) return '🥈 Cavaleiro de Prata';
  if (level < 40) return '🥇 Herói de Ouro';
  if (level < 50) return '💎 Lenda de Diamante';
  return '👑 Mestre Supremo';
}

function getColorForLevel(level: number): number {
  if (level < 10) return 0x2ecc71; // Green
  if (level < 20) return 0xcd7f32; // Bronze
  if (level < 30) return 0xc0c0c0; // Silver
  if (level < 40) return 0xffd700; // Gold
  if (level < 50) return 0xb9f2ff; // Diamond
  return 0x9b59b6; // Purple
}
