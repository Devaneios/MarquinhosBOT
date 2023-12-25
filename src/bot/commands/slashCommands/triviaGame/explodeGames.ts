import { SlashCommandBuilder } from '@discordjs/builders';
import { Client, CommandInteraction } from 'discord.js';

export const explodeTriviaGames = {
  command: new SlashCommandBuilder()
    .setName('explodir-trivia')
    .setDescription('Exclui todos os jogos de trivia do servidor'),
  execute: async (interaction: CommandInteraction) => {
    const { triviaGames } = interaction.guild?.client as Client;
    triviaGames.forEach((game) => game.endGame());
    triviaGames.clear();

    await interaction.reply({
      content: 'Todos os jogos de trivia foram finalizados',
      ephemeral: true,
    });
  },
};
