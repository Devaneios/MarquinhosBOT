import {
  ChannelType,
  SlashCommandBuilder,
  TextChannel
} from 'discord.js';

import { SlashCommand } from '@marquinhos/types';

export const test: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName('test')
    .setDescription(
      'Envio uma mensagem em anônimo pra um canal. (Quase) Ninguém vai saber quem deixou a mensagem.'
    ),
  execute: async (interaction) => {
    const channel = interaction.guild?.channels.cache.find(
      (channel: TextChannel) => channel.type === ChannelType.GuildText
    ) as TextChannel;
    if (!channel) {
      return interaction.reply('Não encontrei nenhum canal de texto.');
    }

    const addedOnQueueEmbed = interaction.client
      .baseEmbed()
      .setDescription(
        '[Overdrive (feat. Norma Jean Martine)](https://open.spotify.com/track/3bK1zVFBKIzYjmptmI4NsJ)'
      )
      .addFields(
        {
          name: 'Autor',
          value: 'Ofenbach, Norma Jean Martine',
          inline: true,
        },
        {
          name: 'Duração',
          value: '02:35',
          inline: true,
        }
      )
      .setThumbnail(
        'https://i.scdn.co/image/ab67616d0000b273249f764814d57dc5dfc462c7'
      );

    await interaction.reply({
      embeds: [addedOnQueueEmbed],
    });
  },
  cooldown: 10,
};
