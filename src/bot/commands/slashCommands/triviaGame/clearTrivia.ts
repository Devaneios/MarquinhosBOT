import { SlashCommandBuilder } from '@discordjs/builders';
import { Client, CommandInteraction } from 'discord.js';

export const clearTrivia = {
  command: new SlashCommandBuilder()
    .setName('clear-trivia')
    .setDescription('Force delete all trivia games in the server'),
  execute: async (interaction: CommandInteraction) => {
    const { triviaGames } = interaction.guild?.client as Client;
    triviaGames.forEach((game) => game.endGame());
    triviaGames.clear();
  },
};
