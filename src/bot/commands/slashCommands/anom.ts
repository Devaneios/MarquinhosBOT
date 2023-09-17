import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChannelType,
  TextChannel,
} from 'discord.js';

import { SlashCommand } from 'src/types';

export const anom: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName('anom')
    .setDescription(
      'Envio uma mensagem em anônimo pra um canal. (Quase) Ninguém vai saber quem deixou a mensagem.'
    )
    .addChannelOption((option) =>
      option
        .setName('canal')
        .setDescription('Canal que você quer que eu envie a mensagem')
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText)
    )
    .addStringOption((option) =>
      option
        .setName('mensagem')
        .setDescription('O que você quer que eu envie')
        .setRequired(true)
    ),
  execute: async (interaction) => {
    const channel = interaction.options.get('canal').channel as TextChannel;
    const message = interaction.options.get('mensagem').value as string;
    channel.send({
      embeds: [
        new EmbedBuilder()
          .setDescription(message)
          .setTitle('👀 Alguém disse isso:'),
      ],
    });
  },
  cooldown: 10,
};
