import {
  CommandInteraction,
  CommandInteractionOptionResolver,
  GuildMember,
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

export const playNext: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName('adicionar-a-fila')
    .setDescription('Adiciona uma música ao topo da fila')
    .addStringOption((option) =>
      option
        .setName('musica')
        .setDescription('A música a ser tocada')
        .setRequired(true)
    )
    .addNumberOption((option) =>
      option
        .setName('posicao')
        .setDescription('A posição que a música deve ser adicionada')
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

    await interaction.deferReply();

    const musicQuery = (
      interaction.options as CommandInteractionOptionResolver
    ).getString('musica', true);

    const response = await handlePlay(
      musicQuery,
      interaction.channel!,
      voiceChannel,
      memberId,
      true
    );

    await interaction.editReply(response);
  },
};
