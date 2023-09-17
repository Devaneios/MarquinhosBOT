import { SlashCommandBuilder, EmbedBuilder, GuildMember } from 'discord.js';

import { SlashCommand } from 'src/types';

export const disconnectAll: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName('encerrar-chamada')
    .setDescription('Remove todo mundo da chamada atual')
    .setDefaultMemberPermissions(0),
  execute: async (interaction) => {
    const member = interaction.member as GuildMember;
    const voiceChannel = member?.voice.channel;
    if (!voiceChannel) {
      interaction.reply({
        embeds: [
          new EmbedBuilder().setDescription(
            'Você precisa estar em um canal de voz para usar esse comando'
          ),
        ],
      });
      return;
    }

    const activeUsers = voiceChannel.members.values();
    for (const user of activeUsers) {
      await user.voice.setChannel(null);
    }

    interaction.reply({
      embeds: [
        new EmbedBuilder().setDescription(
          'Todos os usuários foram desconectados'
        ),
      ],
    });
  },
  cooldown: 10,
};
