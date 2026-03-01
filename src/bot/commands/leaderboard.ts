import { SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '@marquinhos/types';
import { MarquinhosApiService } from '@marquinhos/services/marquinhosApi';

const apiService = new MarquinhosApiService();

export const leaderboard: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Mostra o ranking de níveis do servidor')
    .addIntegerOption((option) =>
      option
        .setName('limite')
        .setDescription('Número de usuários para mostrar (padrão: 10)')
        .setMinValue(5)
        .setMaxValue(25)
        .setRequired(false)
    ),
  execute: async (interaction) => {
    await interaction.deferReply();
    
    const limit = interaction.options.getInteger('limite') || 10;
    const guildId = interaction.guildId;
    
    if (!guildId) {
      await interaction.editReply('Este comando só pode ser usado em servidores!');
      return;
    }

    try {
      const leaderboard = await apiService.getLeaderboard(guildId, limit);
      
      if (!leaderboard?.data || leaderboard.data.length === 0) {
        await interaction.editReply('Nenhum usuário encontrado no ranking.');
        return;
      }

      let description = '';
      for (let i = 0; i < leaderboard.data.length; i++) {
        const user = leaderboard.data[i]!;
        const position = i + 1;
        const medal = getMedal(position);
        
        try {
          const discordUser = await interaction.client.users.fetch(user.userId);
          description += `${medal} **${position}.** ${discordUser.username} - Nível ${user.level} (${user.totalXp} XP total)\n`;
        } catch {
          description += `${medal} **${position}.** Usuario desconhecido - Nível ${user.level} (${user.totalXp} XP total)\n`;
        }
      }

      const embed = interaction.client.baseEmbed()
        .setTitle(`🏆 Ranking do ${interaction.guild?.name}`)
        .setDescription(description)
        .setFooter({ text: `Mostrando top ${leaderboard.data.length} usuários` });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      await interaction.editReply('Ocorreu um erro ao buscar o ranking.');
    }
  },
  cooldown: 30,
};

function getMedal(position: number): string {
  switch (position) {
    case 1: return '🥇';
    case 2: return '🥈';
    case 3: return '🥉';
    default: return '🏅';
  }
}
