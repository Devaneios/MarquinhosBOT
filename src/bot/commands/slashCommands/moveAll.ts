import {
  SlashCommandBuilder,
  PermissionsBitField,
  ChannelType,
  GuildMember,
  VoiceChannel,
} from 'discord.js';

import { SlashCommand } from '@marquinhos/types';

export const moveAll: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName('mover-todos')
    .setDescription('Move todos do canal pra o canal escolhido')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.MoveMembers)
    .addChannelOption((option) =>
      option
        .setName('canal')
        .setDescription('Canal escolhido para os membros serem movidos')
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildVoice)
    ),
  execute: async (interaction) => {
    const member = interaction.member as GuildMember;
    const voiceChannel = member.voice.channel;
    const newVoiceChannel = interaction.options.get('canal')
      .channel as VoiceChannel;

    if (!voiceChannel) {
      await interaction.reply('Mas tu nem tá num canal de voz vei :(');
      return;
    }

    voiceChannel.members.forEach((user) => {
      user.voice.setChannel(newVoiceChannel);
    });
  },
};
