import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

import { SlashCommand } from '@marquinhos/types';

export const ping: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName('ping')
    .setDescription("Shows the bot's ping"),
  execute: (interaction) => {
    const pingEmbed = interaction.client.baseEmbed();
    interaction.reply({
      embeds: [
        pingEmbed
          .setAuthor({
            name: interaction.user.username,
            iconURL: interaction.user.avatarURL() ?? undefined,
          })
          .setDescription(`🏓 Pong! \n 📡 Ping: ${interaction.client.ws.ping}`),
      ],
    });
  },
  cooldown: 10,
};
