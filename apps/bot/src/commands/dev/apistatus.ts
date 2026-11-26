import { commandDefinitions } from '@marquinhos/lib/commandDefinitions';
import { MarquinhosCommand } from '@marquinhos/lib/MarquinhosCommand';
import { MarquinhosApiService } from '@marquinhos/services/marquinhosApi';
import { baseEmbed } from '@marquinhos/utils/discord';
import { Command } from '@sapphire/framework';

const api = MarquinhosApiService.getInstance();

export class ApiStatusCommand extends MarquinhosCommand {
  public constructor(context: Command.LoaderContext) {
    super(context, commandDefinitions['apistatus']);
  }

  override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    await interaction.deferReply();
    const online = await api.healthCheck();
    const embed = baseEmbed(this.container.client);
    embed
      .setAuthor({
        name: interaction.user.username,
        iconURL: interaction.user.avatarURL() ?? undefined,
      })
      .setDescription(
        online
          ? '✅ API online and responding normally.'
          : '❌ API is unreachable.',
      );
    await interaction.editReply({ embeds: [embed] });
  }
}
