import { MarquinhosCommand } from '@marquinhos/lib/MarquinhosCommand';
import { baseEmbed } from '@marquinhos/utils/discord';
import { Command } from '@sapphire/framework';
import {
  ChannelType,
  PermissionsBitField,
  type GuildTextBasedChannel,
  type User,
} from 'discord.js';

const EMBED_DESCRIPTION_MAX_LENGTH = 4096;

function canSendIn(channel: GuildTextBasedChannel, user: User): boolean {
  return (
    channel
      .permissionsFor(user)
      ?.has([
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
      ]) ?? false
  );
}

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
            .setRequired(true)
            .setMaxLength(EMBED_DESCRIPTION_MAX_LENGTH),
        ),
    );
  }

  override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const channel = interaction.options.getChannel('canal', true, [
      ChannelType.GuildText,
    ]);
    const message = interaction.options.getString('mensagem', true);

    // The bot posts on the member's behalf, so it must not reach channels
    // the member could not post in themselves (announcements, rules).
    if (!canSendIn(channel, interaction.user)) {
      await interaction.reply({
        content: 'Você não pode enviar mensagens nesse canal.',
        ephemeral: true,
      });
      return;
    }

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
