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
        interaction.reply(
          'This server does not have an active player session.'
        );
        return;
      }

      if (!queue.isPlaying()) {
        interaction.reply('There is no track playing.');
        return;
      }

      // Skip the current track
      queue.node.skip();

      // Send a confirmation message
      interaction.reply('The current song has been skipped.');
    } catch (error) {
      // Handle any errors that occur
      console.error(error);
      interaction.reply('An error occurred while skipping the song!');
    }
  },
};
