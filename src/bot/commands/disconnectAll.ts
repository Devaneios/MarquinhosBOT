import { SlashCommand } from '@marquinhos/types';
import {
  GuildMember,
  PermissionsBitField,
  SlashCommandBuilder,
} from 'discord.js';

export const disconnectAll: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName('encerrar-chamada')
    .setDescription('Remove todo mundo da chamada atual')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.MoveMembers),
  execute: async (interaction) => {
    const member = interaction.member as GuildMember;
    const voiceChannel = member?.voice.channel;
    const disconnectAllEmbed = interaction.client.baseEmbed();
    if (!voiceChannel) {
      await interaction.reply({
        embeds: [
          disconnectAllEmbed.setDescription(
            'Você precisa estar em um canal de voz para usar esse comando',
          ),
        ],
      });
      return;
    }

    const activeUsers = voiceChannel.members.values();
    for (const user of activeUsers) {
      await user.voice.setChannel(null);
    }

    await interaction.reply({
      embeds: [
        disconnectAllEmbed.setDescription(
          'Todos os usuários foram desconectados',
        ),
      ],
    });
  },
  cooldown: 10,
};
