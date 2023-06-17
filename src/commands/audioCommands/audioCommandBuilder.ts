import { EmbedBuilder, Message, SlashCommandBuilder } from 'discord.js';
import { AudioCommandBuilder, Command, SlashCommand } from '../../types';
import { voiceChannelPresence, playAudio } from '../../utils/discord';

export const audioCommandBuilder = (file: string): AudioCommandBuilder => {
  return {
    slashCommand: slashCommandBuilder(file),
    textCommand: textCommandBuilder(file),
  };
};

const textCommandBuilder = (file: string): Command => {
  const command: Command = {
    name: file.replace('.mp3', ''),
    execute: (message: Message, args: string[]) => {
      const channel = voiceChannelPresence(message);
      playAudio(message, channel, file.replace('.mp3', ''));
    },
    cooldown: 10,
    aliases: [],
    permissions: [],
  };

  return command;
};

const slashCommandBuilder = (file: string): SlashCommand => {
  const slashCommand: SlashCommand = {
    command: new SlashCommandBuilder()
      .setName(file.replace('.mp3', ''))
      .setDescription(`Playing ${file.replace('.mp3', '')}`),
    execute: (interaction) => {
      const channel = voiceChannelPresence(interaction);
      playAudio(interaction, channel, file.replace('.mp3', ''));
      interaction.reply({
        embeds: [
          new EmbedBuilder().setDescription(
            `Playing ${file.replace('.mp3', '')}`
          ),
        ],
      });
    },
    cooldown: 10,
  };

  return slashCommand;
};
