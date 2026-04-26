import { MarquinhosCommand } from '@marquinhos/lib/MarquinhosCommand';
import { resourcePath } from '@marquinhos/utils/resources';
import { Command } from '@sapphire/framework';
import { MessageFlags } from 'discord.js';

export class CatCommand extends MarquinhosCommand {
  public constructor(context: Command.LoaderContext) {
    super(context, { name: 'gato', cooldownDelay: 10_000 });
  }

  override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder.setName(this.commandName).setDescription('GATO'),
    );
  }

  override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const channel = interaction.channel;
    if (!channel?.isSendable()) {
      await interaction.editReply('Não consegui enviar mensagens nesse canal.');
      return;
    }

    await channel.send({
      files: [
        {
          attachment: resourcePath('animations', 'cat-up.gif'),
          name: 'cat-up.gif',
          description: 'Gato subindo',
        },
      ],
    });

    await channel.send({
      files: [
        {
          attachment: resourcePath('animations', 'cat-down.gif'),
          name: 'cat-down.gif',
          description: 'Gato descendo',
        },
      ],
    });

    await interaction.deleteReply();
  }
}
