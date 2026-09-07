import { MarquinhosCommand } from '@marquinhos/lib/MarquinhosCommand';
import { MarquinhosApiService } from '@marquinhos/services/marquinhosApi';
import { baseEmbed } from '@marquinhos/utils/discord';
import { logger } from '@marquinhos/utils/logger';
import { Command } from '@sapphire/framework';

const apiService = MarquinhosApiService.getInstance();

export class LeaderboardCommand extends MarquinhosCommand {
  public constructor(context: Command.LoaderContext) {
    super(context, { name: 'leaderboard', cooldownDelay: 30_000 });
  }

  override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.commandName)
        .setDescription('Mostra o ranking de níveis do servidor')
        .addIntegerOption((option) =>
          option
            .setName('limite')
            .setDescription('Número de usuários para mostrar (padrão: 10)')
            .setMinValue(5)
            .setMaxValue(25)
            .setRequired(false),
        ),
    );
  }

  override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    await interaction.deferReply();
    const limit = interaction.options.getInteger('limite') || 10;
    const guildId = interaction.guildId;

    if (!guildId) {
      await interaction.editReply(
        'Este comando só pode ser usado em servidores!',
      );
      return;
    }

    try {
      const leaderboard = await apiService.getLeaderboard(guildId, limit);
      if (!leaderboard?.data || leaderboard.data.length === 0) {
        await interaction.editReply('Nenhum usuário encontrado no ranking.');
        return;
      }

      const userResults = await Promise.allSettled(
        leaderboard.data.map((entry) =>
          interaction.client.users.fetch(entry.userId),
        ),
      );

      let description = '';
      for (let i = 0; i < leaderboard.data.length; i++) {
        const user = leaderboard.data[i]!;
        const position = i + 1;
        const medal = getMedal(position);
        const fetchResult = userResults[i];
        const username =
          fetchResult.status === 'fulfilled'
            ? fetchResult.value.username
            : 'Usuario desconhecido';
        description += `${medal} **${position}.** ${username} - Nível ${user.level} (${user.totalXp} XP total)\n`;
      }

      const embed = baseEmbed(this.container.client)
        .setTitle(`🏆 Ranking do ${interaction.guild?.name}`)
        .setDescription(description)
        .setFooter({
          text: `Mostrando top ${leaderboard.data.length} usuários`,
        });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logger.error('Error fetching leaderboard:', error);
      await interaction.editReply('Ocorreu um erro ao buscar o ranking.');
    }
  }
}

function getMedal(position: number): string {
  switch (position) {
    case 1:
      return '🥇';
    case 2:
      return '🥈';
    case 3:
      return '🥉';
    default:
      return '🏅';
  }
}
