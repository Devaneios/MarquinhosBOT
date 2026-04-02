import { SlashCommand } from '@marquinhos/types';
import {
  ChannelType,
  ChatInputCommandInteraction,
  PermissionsBitField,
  SlashCommandBuilder,
  TextChannel,
} from 'discord.js';

export const anom: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName('anom')
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
  execute: async (interaction: ChatInputCommandInteraction) => {
    const channel = interaction.options.getChannel('canal') as TextChannel;
    const message = interaction.options.getString('mensagem', true);

    // Verify bot has SendMessages permission in the target channel
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

    const anomEmbed = interaction.client.baseEmbed();
    await channel.send({
      embeds: [
        anomEmbed.setTitle('👀 Alguém disse isso:').setDescription(message),
      ],
    });
    await interaction.reply({
      content: 'Mensagem enviada.',
      ephemeral: true,
    });
  },
  cooldown: 10,
};
