import { SlashCommandBuilder } from '@discordjs/builders';
import { TriviaGame } from '@marquinhos/games';
import { TriviaDifficulty } from '@marquinhos/types';
import { Client, CommandInteraction, EmbedBuilder } from 'discord.js';

export const startTriviaGame = {
  command: new SlashCommandBuilder()
    .setName('iniciar-trivia')
    .setDescription('Inicializa um jogo de trivia neste canal')
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
    ),
  execute: async (interaction: CommandInteraction) => {
    const category = interaction.options.get('categoria').value as string;
    const difficulty = interaction.options.get('dificuldade')
      .value as TriviaDifficulty;

    const { triviaGames } = interaction.guild?.client as Client;
    if (triviaGames.get(interaction.channelId)) {
      return interaction.reply({
        content: 'Já existe um jogo de trivia nesse canal',
        ephemeral: true,
      });
    }

    const game = new TriviaGame(category, difficulty, interaction.user.id);
    triviaGames.set(interaction.channelId, game);

    await interaction.reply({
      content: 'Iniciando jogo de trivia...',
      ephemeral: true,
    });
    const question = await game.askQuestion();
    const questionEmbed = await interaction.channel?.send({
      embeds: [
        new EmbedBuilder()
          .setDescription(`**${question.question}**`)
          .setTitle('Questão 1'),
      ],
    });
    const questionsAsked = 1;
    const interval = setInterval(async () => {
      const question = await game.askQuestion();
      const questionEmbed = await interaction.channel?.send({
        embeds: [
          new EmbedBuilder()
            .setDescription(`**${question.question}**`)
            .setTitle(`Questão ${questionsAsked + 1}`),
        ],
      });
    }, 15000);

    setTimeout(() => {
      clearInterval(interval);
      game.endGame();
      triviaGames.delete(interaction.channelId);
    }, 15000 * 2);
  },
};
