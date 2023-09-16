import { SlashCommandBuilder, EmbedBuilder, Client } from 'discord.js';
import { SlashCommand } from '../../types';
import { readdirSync } from 'fs';
import { logger } from 'src/utils/logger';
import { join } from 'path';
import { playAudio, voiceChannelPresence } from 'src/utils/discord';

const audiosDir = join(__dirname, '../../resources/sounds/');
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
    playAudio(interaction, channel, file.value as string);
    interaction.reply({
      embeds: [
        new EmbedBuilder().setDescription(
          `Reproduzindo ${file.value as string}`
        ),
      ],
    });
  },
  cooldown: 10,
};
