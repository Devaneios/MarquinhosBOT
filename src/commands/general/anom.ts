import { MarquinhosCommand } from '@marquinhos/lib/MarquinhosCommand';
import { baseEmbed } from '@marquinhos/utils/discord';
import { Command } from '@sapphire/framework';
import { ChannelType, PermissionsBitField, TextChannel } from 'discord.js';

export class AnomCommand extends MarquinhosCommand {
  public constructor(context: Command.LoaderContext) {
    super(context, { name: 'anom', cooldownDelay: 10_000 });
  }

  override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.commandName)
        .setDescription(
          'Envio uma mensagem em anônimo pra um canal. (Quase) Ninguém vai saber quem deixou a mensagem.',
        )
        .addChannelOption((option) =>
          option
            .setName('canal')
            .setDescription('Canal que você quer que eu envie a mensagem')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText),
        )
        .addStringOption((option) =>
          option
            .setName('mensagem')
            .setDescription('O que você quer que eu envie')
            .setRequired(true),
        ),
    );
  }

  override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const channel = interaction.options.getChannel('canal') as TextChannel;
    const message = interaction.options.getString('mensagem', true);

    const botMember = interaction.guild?.members.me;
    if (
      botMember &&
      !channel
        .permissionsFor(botMember)
        ?.has(PermissionsBitField.Flags.SendMessages)
    ) {
      await interaction.reply({
        content: 'Não tenho permissão para enviar mensagens nesse canal.',
        ephemeral: true,
      });
      return;
    }

    const anomEmbed = baseEmbed(this.container.client);
    await channel.send({
      embeds: [
        anomEmbed.setTitle('👀 Alguém disse isso:').setDescription(message),
      ],
    });
    await interaction.reply({
      content: 'Mensagem enviada.',
      ephemeral: true,
    });
  }
}
