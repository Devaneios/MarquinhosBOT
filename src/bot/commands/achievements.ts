import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { SlashCommand } from '@marquinhos/types';
import { MarquinhosApiService } from '@marquinhos/services/marquinhosApi';

const apiService = new MarquinhosApiService();

export const achievements: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName('achievements')
    .setDescription('Mostra suas conquistas desbloqueadas')
    .addUserOption((option) =>
      option
        .setName('usuario')
        .setDescription('Usuário para verificar as conquistas (opcional)')
        .setRequired(false)
    ) as SlashCommandBuilder,
  execute: async (interaction) => {
    await interaction.deferReply();
    
    const targetUser = interaction.options.getUser('usuario') || interaction.user;
    const userId = targetUser.id;
    const guildId = interaction.guildId;
    
    if (!guildId) {
      await interaction.editReply('Este comando só pode ser usado em servidores!');
      return;
    }

    try {
      const userAchievements = await apiService.getUserAchievements(userId, guildId);
      
      if (!userAchievements?.data || userAchievements.data.length === 0) {
        await interaction.editReply(`${targetUser.username} ainda não possui conquistas desbloqueadas.`);
        return;
      }

      const achievementsByRarity = {
        legendary: [],
        epic: [],
        rare: [],
        common: []
      };

      // Group achievements by rarity
      for (const userAchievement of userAchievements.data) {
        const achievement = userAchievement.achievementId;
        if (achievement && achievement.rarity) {
          achievementsByRarity[achievement.rarity].push(achievement);
        }
      }

      const embed = interaction.client.baseEmbed()
        .setTitle(`🏆 Conquistas de ${targetUser.username}`)
        .setThumbnail(targetUser.displayAvatarURL())
        .setFooter({ text: `Total: ${userAchievements.data.length} conquistas` });

      // Add fields for each rarity (if any achievements exist)
      if (achievementsByRarity.legendary.length > 0) {
        const legendaryText = achievementsByRarity.legendary
          .map(a => `${a.icon} **${a.name}**`)
          .join('\n');
        embed.addFields({ name: '🌟 Lendárias', value: legendaryText, inline: false });
      }

      if (achievementsByRarity.epic.length > 0) {
        const epicText = achievementsByRarity.epic
          .map(a => `${a.icon} **${a.name}**`)
          .join('\n');
        embed.addFields({ name: '💜 Épicas', value: epicText, inline: false });
      }

      if (achievementsByRarity.rare.length > 0) {
        const rareText = achievementsByRarity.rare
          .map(a => `${a.icon} **${a.name}**`)
          .join('\n');
        embed.addFields({ name: '💙 Raras', value: rareText, inline: false });
      }

      if (achievementsByRarity.common.length > 0) {
        const commonText = achievementsByRarity.common
          .map(a => `${a.icon} **${a.name}**`)
          .join('\n');
        embed.addFields({ name: '⚪ Comuns', value: commonText, inline: false });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error fetching user achievements:', error);
      await interaction.editReply('Ocorreu um erro ao buscar as conquistas.');
    }
  },
  cooldown: 10,
};
