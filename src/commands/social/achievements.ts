import { buildAchievementsEmbed } from '@marquinhos/formatters/achievements';
import { MarquinhosCommand } from '@marquinhos/lib/MarquinhosCommand';
import { MarquinhosApiService } from '@marquinhos/services/marquinhosApi';
import { logger } from '@marquinhos/utils/logger';
import { Command } from '@sapphire/framework';

const apiService = MarquinhosApiService.getInstance();

export class AchievementsCommand extends MarquinhosCommand {
  public constructor(context: Command.LoaderContext) {
    super(context, { name: 'achievements', cooldownDelay: 10_000 });
  }

  override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.commandName)
        .setDescription('Mostra suas conquistas desbloqueadas')
        .addUserOption((option) =>
          option
            .setName('usuario')
            .setDescription('Usuário para verificar as conquistas (opcional)')
            .setRequired(false),
        ),
    );
  }

  override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    await interaction.deferReply();
    const targetUser =
      interaction.options.getUser('usuario') || interaction.user;
    const guildId = interaction.guildId;

    if (!guildId) {
      await interaction.editReply(
        'Este comando só pode ser usado em servidores!',
      );
      return;
    }

    try {
      const response = await apiService.getUserAchievements(
        targetUser.id,
        guildId,
      );
      if (!response?.data || response.data.length === 0) {
        await interaction.editReply(
          `${targetUser.username} ainda não possui conquistas desbloqueadas.`,
        );
        return;
      }

      const embed = buildAchievementsEmbed(
        this.container.client,
        targetUser,
        response.data,
      );
      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logger.error('Error fetching user achievements:', error);
      await interaction.editReply('Ocorreu um erro ao buscar as conquistas.');
    }
  }
}
