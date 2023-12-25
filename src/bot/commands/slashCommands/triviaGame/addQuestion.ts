import { SlashCommandBuilder } from '@discordjs/builders';
import { addQuestion } from '@marquinhos/games';
import { ITriviaQuestion, TriviaDifficulty } from '@marquinhos/types';
import { CommandInteraction } from 'discord.js';

export const addTriviaQuestion = {
  command: new SlashCommandBuilder()
    .setName('adicionar-questão-trivia')
    .setDescription('Adds a trivia question')
    .addStringOption((option) =>
      option
        .setName('categoria')
        .setDescription('Escolha uma categoria')
        .setRequired(true)
        .addChoices({ name: 'Geral', value: 'general' })
    )
    .addStringOption((option) =>
      option
        .setName('dificuldade')
        .setDescription('Escolha uma dificuldade')
        .setRequired(true)
        .addChoices(
          { name: 'Fácil', value: 'easy' },
          { name: 'Médio', value: 'medium' },
          { name: 'Difícil', value: 'hard' }
        )
    )
    .addStringOption((option) =>
      option.setName('questão').setDescription('Questão').setRequired(true)
    )
    .addStringOption((option) =>
      option.setName('resposta').setDescription('Resposta').setRequired(true)
    ),
  execute: async (interaction: CommandInteraction) => {
    const category = interaction.options.get('categoria').value as string;
    const difficulty = interaction.options.get('dificuldade')
      .value as TriviaDifficulty;
    const question = interaction.options.get('questão').value as string;
    const answer = interaction.options.get('resposta').value as string;

    const questionCreated = await addQuestion({
      question,
      answer,
      playersAnswered: [],
      lastTimeAsked: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      timesAsked: 0,
      hints: [],
      category,
      difficulty,
    } as ITriviaQuestion);

    if (questionCreated) {
      return interaction.reply({
        content: 'Questão criada com sucesso',
        ephemeral: true,
      });
    } else {
      return interaction.reply({
        content: 'Não foi possível criar a questão',
        ephemeral: true,
      });
    }
  },
};
