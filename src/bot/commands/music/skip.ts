import {
  isCurrentlyInVoiceChannel,
  isUserInVoiceChannel,
} from '@marquinhos/bot/validators/voice-channel';
import { SlashCommand } from '@marquinhos/types';
import { logger } from '@marquinhos/utils/logger';
import { useQueue } from 'discord-player';
import { CommandInteraction, SlashCommandBuilder } from 'discord.js';

export const skip: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName('pular')
    .setDescription('Pula a música atual'),
  validators: [isUserInVoiceChannel, isCurrentlyInVoiceChannel],
  execute: async (interaction: CommandInteraction) => {
    try {
      const queue = useQueue();

      if (!queue) {
        await interaction.reply('Não há uma sessão de reprodução ativa.');
        return;
      }

      if (!queue.isPlaying()) {
        await interaction.reply('Não há nenhuma música tocando.');
        return;
      }

      queue.node.skip();

      await interaction.reply('A música atual foi pulada.');
    } catch (error) {
      logger.error('Error skipping track:', error);
      await interaction.reply('Ocorreu um erro ao pular a música!');
    }
  },
};
