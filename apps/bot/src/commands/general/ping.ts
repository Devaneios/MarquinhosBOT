import { MarquinhosCommand } from '@marquinhos/lib/MarquinhosCommand';
import { baseEmbed } from '@marquinhos/utils/discord';
import { Command } from '@sapphire/framework';

export class PingCommand extends MarquinhosCommand {
  public constructor(context: Command.LoaderContext) {
    super(context, { name: 'ping', cooldownDelay: 10_000 });
  }

  override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder.setName(this.commandName).setDescription("Shows the bot's ping"),
    );
  }

  override chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    const embed = baseEmbed(this.container.client)
      .setAuthor({
        name: interaction.user.username,
        iconURL: interaction.user.avatarURL() ?? undefined,
      })
      .setDescription(`🏓 Pong! \n 📡 Ping: ${this.container.client.ws.ping}`);
    return interaction.reply({ embeds: [embed] });
  }
}
