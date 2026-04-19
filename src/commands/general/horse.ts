import { MarquinhosCommand } from '@marquinhos/lib/MarquinhosCommand';
import { resourcePath } from '@marquinhos/utils/resources';
import { Command } from '@sapphire/framework';

export class HorseCommand extends MarquinhosCommand {
  public constructor(context: Command.LoaderContext) {
    super(context, { name: 'cavalo', cooldownDelay: 10_000 });
  }

  override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder.setName(this.commandName).setDescription('CAVALO'),
    );
  }

  override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    interaction.reply({
      files: [
        {
          attachment: resourcePath('animations', 'cavalo.gif'),
          name: 'cavalo.gif',
          description: 'CAVALO',
        },
      ],
    });
  }
}
