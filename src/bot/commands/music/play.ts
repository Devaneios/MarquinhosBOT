import {
  CommandInteraction,
  CommandInteractionOptionResolver,
  GuildMember,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';

import {
  canJoinVoiceChannel,
  canSpeakVoiceChannel,
  isCurrentlyInVoiceChannel,
  isUserInVoiceChannel,
} from '@marquinhos/bot/validators/voice-channel';
import { SlashCommand } from '@marquinhos/types';
import { handlePlay } from './utils';

export const play: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Toca uma música')
    .addStringOption((option) =>
      option
        .setName('musica')
        .setDescription('A música a ser tocada')
        .setRequired(true)
    ),
  validators: [
    isUserInVoiceChannel,
    isCurrentlyInVoiceChannel,
    canSpeakVoiceChannel,
    canJoinVoiceChannel,
  ],
  execute: async (interaction: CommandInteraction) => {
    const voiceChannel = (interaction.member as GuildMember).voice.channel!;
    const memberId = (interaction.member as GuildMember).id;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const musicQuery = (
      interaction.options as CommandInteractionOptionResolver
    ).getString('musica', true);

    const response = await handlePlay(
      musicQuery,
      interaction.channel!,
      voiceChannel,
      memberId
    );

    await interaction.editReply(response);
  },
};
