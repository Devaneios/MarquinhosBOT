import {
  canJoinVoiceChannel,
  canSpeakVoiceChannel,
  isCurrentlyInVoiceChannel,
  isUserInVoiceChannel,
} from '@marquinhos/bot/validators/voice-channel';
import { SlashCommand } from '@marquinhos/types';
import { joinVoiceChannel } from 'discord-player';
import { GuildMember, SlashCommandBuilder } from 'discord.js';

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      adapterCreator: voiceChannel.guild.voiceAdapterCreator as any,
    });
    const addedOnQueueEmbed = interaction.client
      .baseEmbed()
      .setDescription('Entrei no canal de voz :)');

    await interaction.reply({
      embeds: [addedOnQueueEmbed],
    });
  },
};
