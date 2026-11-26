import { commandDefinitions } from '@marquinhos/lib/commandDefinitions';
import { MarquinhosCommand } from '@marquinhos/lib/MarquinhosCommand';
import { baseEmbed } from '@marquinhos/utils/discord';
import { Command } from '@sapphire/framework';

export class AudioCommand extends MarquinhosCommand {
  public constructor(context: Command.LoaderContext) {
    super(context, commandDefinitions['audio']);
  }

  override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const file = interaction.options.getString('audio', true);
    const embed = baseEmbed(this.container.client).setDescription(
      `Reproduzindo ${file}`,
    );
    return interaction.reply({ embeds: [embed] });
  }
}
