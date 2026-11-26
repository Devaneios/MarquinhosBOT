import { buildLevelEmbed } from '@marquinhos/formatters/level';
import { commandDefinitions } from '@marquinhos/lib/commandDefinitions';
import { MarquinhosCommand } from '@marquinhos/lib/MarquinhosCommand';
import { MarquinhosApiService } from '@marquinhos/services/marquinhosApi';
import { logger } from '@marquinhos/utils/logger';
import { Command } from '@sapphire/framework';

const apiService = MarquinhosApiService.getInstance();

export class LevelCommand extends MarquinhosCommand {
  public constructor(context: Command.LoaderContext) {
    super(context, commandDefinitions['level']);
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
      const userLevel = await apiService.getUserLevel(targetUser.id, guildId);
      if (!userLevel?.data) {
        await interaction.editReply(
          `${targetUser.username} ainda não possui níveis registrados.`,
        );
        return;
      }

      const embed = buildLevelEmbed(
        this.container.client,
        targetUser,
        userLevel.data,
      );
      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logger.error('Error fetching user level:', error);
      await interaction.editReply(
        'Ocorreu um erro ao buscar as informações de nível.',
      );
    }
  }
}
