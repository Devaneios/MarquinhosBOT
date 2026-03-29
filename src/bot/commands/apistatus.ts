import { MarquinhosApiService } from '@marquinhos/services/marquinhosApi';
import { SlashCommand } from '@marquinhos/types';
import { SlashCommandBuilder } from 'discord.js';

const api = new MarquinhosApiService();

export const apistatus: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName('apistatus')
    .setDescription('Checks whether the Marquinhos API is available'),
  execute: async (interaction) => {
    await interaction.deferReply();
    const online = await api.healthCheck();
    const embed = interaction.client.baseEmbed();
    embed
      .setAuthor({
        name: interaction.user.username,
        iconURL: interaction.user.avatarURL() ?? undefined,
      })
      .setDescription(
        online
          ? '✅ API online and responding normally.'
          : '❌ API is unreachable.',
      );
    await interaction.editReply({ embeds: [embed] });
  },
  cooldown: 10,
};
