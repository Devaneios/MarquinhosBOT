import { GuildMember, SlashCommandBuilder } from 'discord.js';

import {
  canJoinVoiceChannel,
  canSpeakVoiceChannel,
  isCurrentlyInVoiceChannel,
  isUserInVoiceChannel,
} from '@marquinhos/bot/validators/voice-channel';
import { SlashCommand } from '@marquinhos/types';
import { joinVoiceChannel } from 'discord-player';

export const test: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName('test')
    .setDescription('Um comando de teste simples.'),
  validators: [
    isUserInVoiceChannel,
    isCurrentlyInVoiceChannel,
    canSpeakVoiceChannel,
    canJoinVoiceChannel,
  ],
  execute: async (interaction) => {
    const voiceChannel = (interaction.member as GuildMember).voice.channel!;
    if (!voiceChannel.joinable) {
      await interaction.reply('Não consigo entrar no canal de voz.');
      return;
    }

    joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    });
    const addedOnQueueEmbed = interaction.client
      .baseEmbed()
      .setDescription(`Entrei no canal de voz :)`);

    await interaction.reply({
      embeds: [addedOnQueueEmbed],
    });
  },
};
