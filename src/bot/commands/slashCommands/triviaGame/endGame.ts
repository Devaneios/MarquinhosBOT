import { SlashCommandBuilder } from '@discordjs/builders';
import { Client, CommandInteraction } from 'discord.js';

export const endTriviaGame = {
  command: new SlashCommandBuilder()
    .setName('finalizar-trivia')
    .setDescription('Força o fim do jogo de trivia neste canal'),
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

    await interaction.reply({
      content: 'Jogo de trivia finalizado',
      ephemeral: true,
    });
  },
};
