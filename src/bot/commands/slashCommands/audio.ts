import { SlashCommandBuilder } from 'discord.js';
import { join } from 'path';
import { readdirSync } from 'fs';

import { SlashCommand } from '@marquinhos/types';
import { logger } from '@utils/logger';
import { playAudio, voiceChannelPresence } from '@utils/discord';

const audiosDir = join(__dirname, '../../../resources/sounds/');
const audios: string[] = [];

readdirSync(audiosDir).forEach((file) => {
  try {
    if (!file.endsWith('.mp3') || file.startsWith('_')) return;
    audios.push(file.replace('.mp3', ''));
    logger.info(`Successfully loaded audio ${file.replace('.mp3', '')}`);
  } catch (error) {
    logger.error(`Error loading audio ${file.replace('.mp3', '')}`);
    logger.error(error);
  }
});

export const audio: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName('audio')
    .setDescription('Reproduz um áudio')
    .addStringOption((option) =>
      option
        .setName('audio')
        .setDescription('Áudio a ser reproduzido')
        .setRequired(true)
        .addChoices(
          ...audios.map((audio) => {
            return { name: audio, value: audio };
          })
        )
    ),

  execute: (interaction) => {
    const channel = voiceChannelPresence(interaction);
    const file = interaction.options.get('audio');
    const audioEmbed = interaction.client.baseEmbed();
    playAudio(interaction, channel, file?.value as string);
    interaction.reply({
      embeds: [
        audioEmbed.setDescription(`Reproduzindo ${file?.value as string}`),
      ],
    });
  },
  cooldown: 10,
};
