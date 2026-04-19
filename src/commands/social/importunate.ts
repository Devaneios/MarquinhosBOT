import { MarquinhosCommand } from '@marquinhos/lib/MarquinhosCommand';
import { Command } from '@sapphire/framework';
import { GuildMember } from 'discord.js';

export class ImportunateCommand extends MarquinhosCommand {
  public constructor(context: Command.LoaderContext) {
    super(context, { name: 'importunar', cooldownDelay: 10_000 });
  }

  override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.commandName)
        .setDescription(
          'Eu vou lá no canal de voz atazanar a vida de quem tu quiser.',
        )
        .addUserOption((option) =>
          option
            .setName('importunado')
            .setDescription('Quem você quer que eu irrite?')
            .setRequired(true),
        ),
    );
  }

  override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const member = interaction.options.get('importunado')
      ?.member as GuildMember;

    if (member.user.bot) {
      interaction.reply({ content: 'Nunca vou conseguir irritar um bot' });
      return;
    }

    if (member.voice.channel) {
      interaction.reply({ content: `${member} AEHOOOOOOOOOOOOOO` });
    } else {
      interaction.reply({
        content: 'Acho que essa pessoa aí não tá num canal de voz..',
      });
    }
  }
}
