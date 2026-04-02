import { SlashCommand } from '@marquinhos/types';
import { logger } from '@marquinhos/utils/logger';
import {
  ChannelType,
  GuildMember,
  PermissionsBitField,
  SlashCommandBuilder,
  VoiceChannel,
} from 'discord.js';

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
        .addChannelTypes(ChannelType.GuildVoice),
    ),
  execute: async (interaction) => {
    const member = interaction.member as GuildMember;
    const voiceChannel = member.voice.channel;
    const newVoiceChannel = interaction.options.getChannel(
      'canal',
    ) as VoiceChannel;

    if (!voiceChannel) {
      await interaction.reply('Mas tu nem tá num canal de voz vei :(');
      return;
    }

    await interaction.deferReply();

    const results = await Promise.allSettled(
      [...voiceChannel.members.values()].map((user) =>
        user.voice.setChannel(newVoiceChannel),
      ),
    );

    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed > 0) {
      logger.warn(`moveAll: ${failed} member(s) could not be moved`);
    }

    const moved = results.filter((r) => r.status === 'fulfilled').length;
    await interaction.editReply(
      `✅ ${moved} membro(s) movido(s) para ${newVoiceChannel.name}.${failed > 0 ? ` (${failed} falha(s))` : ''}`,
    );
  },
  cooldown: 10,
};
