import { CommandInteraction, SlashCommandBuilder } from 'discord.js';

import {
  isCurrentlyInVoiceChannel,
  isUserInVoiceChannel,
} from '@marquinhos/bot/validators/voice-channel';
import { SlashCommand } from '@marquinhos/types';
import { useQueue } from 'discord-player';

export const skip: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName('pular')
    .setDescription('Pula a música atual'),
  validators: [isUserInVoiceChannel, isCurrentlyInVoiceChannel],
  execute: async (interaction: CommandInteraction) => {
    try {
      const queue = useQueue();

      if (!queue) {
        return interaction.reply(
          'This server does not have an active player session.'
        );
      }

      if (!queue.isPlaying()) {
        return interaction.reply('There is no track playing.');
      }

      // Skip the current track
      queue.node.skip();

      // Send a confirmation message
      return interaction.reply('The current song has been skipped.');
    } catch (error) {
      // Handle any errors that occur
      console.error(error);
      return interaction.reply('An error occurred while skipping the song!');
    }
  },
};
