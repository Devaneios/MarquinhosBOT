import { SlashCommandBuilder } from '@discordjs/builders';
import { Client, CommandInteraction } from 'discord.js';

export const endTrivia = {
  command: new SlashCommandBuilder()
    .setName('end-trivia')
    .setDescription('Force end a trivia game'),
  execute: async (interaction: CommandInteraction) => {
    const { triviaGames } = interaction.guild?.client as Client;
    const currentGame = triviaGames.get(interaction.channelId);
    if (!currentGame) {
      return interaction.reply({
        content: 'Não existe um jogo de trivia nesse canal',
        ephemeral: true,
      });
    }
    currentGame.endGame();
    triviaGames.delete(interaction.channelId);
  },
};
