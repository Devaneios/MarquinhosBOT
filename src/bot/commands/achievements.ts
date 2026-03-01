import { MarquinhosApiService } from '@marquinhos/services/marquinhosApi';
import { SlashCommand, UserAchievement } from '@marquinhos/types';
import { SlashCommandBuilder } from 'discord.js';

const apiService = new MarquinhosApiService();

const RARITY_ORDER = ['legendary', 'epic', 'rare', 'common'] as const;
const RARITY_LABELS: Record<string, string> = {
  legendary: '🌟 Lendárias',
  epic: '💜 Épicas',
  rare: '💙 Raras',
  common: '⚪ Comuns',
};

export const achievements: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName('achievements')
    .setDescription('Mostra suas conquistas desbloqueadas')
    .addUserOption((option) =>
      option
        .setName('usuario')
        .setDescription('Usuário para verificar as conquistas (opcional)')
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
      const response = await apiService.getUserAchievements(userId, guildId);

      if (!response?.data || response.data.length === 0) {
        await interaction.editReply(
          `${targetUser.username} ainda não possui conquistas desbloqueadas.`,
        );
        return;
      }

      // Group by rarity — each item is now a flat joined object with all fields populated
      const byRarity: Record<string, UserAchievement[]> = {
        legendary: [],
        epic: [],
        rare: [],
        common: [],
      };

      for (const achievement of response.data) {
        if (byRarity[achievement.rarity]) {
          byRarity[achievement.rarity].push(achievement);
        }
      }

      const embed = interaction.client
        .baseEmbed()
        .setTitle(`🏆 Conquistas de ${targetUser.username}`)
        .setThumbnail(targetUser.displayAvatarURL())
        .setFooter({ text: `Total: ${response.data.length} conquistas` });

      for (const rarity of RARITY_ORDER) {
        const list = byRarity[rarity];
        if (list.length === 0) continue;
        embed.addFields({
          name: RARITY_LABELS[rarity],
          value: list.map((a) => `${a.icon} **${a.name}**`).join('\n'),
          inline: false,
        });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error fetching user achievements:', error);
      await interaction.editReply('Ocorreu um erro ao buscar as conquistas.');
    }
  },
  cooldown: 10,
};
