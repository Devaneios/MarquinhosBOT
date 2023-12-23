import { SlashCommandBuilder } from '@discordjs/builders';
import { TriviaGame } from '@marquinhos/games';
import { TriviaDifficulty } from '@marquinhos/types';
import { Client, CommandInteraction } from 'discord.js';

export const startTrivia = {
  command: new SlashCommandBuilder()
    .setName('start-trivia')
    .setDescription('Start a trivia game')
    .addStringOption((option) =>
      option
        .setName('Categoria')
        .setDescription('Escolha uma categoria')
        .setRequired(true)
        .addChoices({ name: 'Geral', value: 'general' })
    )
    .addStringOption((option) =>
      option
        .setName('Dificuldade')
        .setDescription('Escolha uma dificuldade')
        .setRequired(true)
        .addChoices(
          { name: 'Fácil', value: 'easy' },
          { name: 'Médio', value: 'medium' },
          { name: 'Difícil', value: 'hard' }
        )
    ),
  execute: async (interaction: CommandInteraction) => {
    const category = interaction.options.get('Categoria').value as string;
    const difficulty = interaction.options.get('Dificuldade')
      .value as TriviaDifficulty;

    const { triviaGames } = interaction.guild?.client as Client;
    if (triviaGames.get(interaction.channelId)) {
      return interaction.reply({
        content: 'Já existe um jogo de trivia nesse canal',
        ephemeral: true,
      });
    }

    const game = new TriviaGame(category, difficulty);
    triviaGames.set(interaction.channelId, game);
  },
};
