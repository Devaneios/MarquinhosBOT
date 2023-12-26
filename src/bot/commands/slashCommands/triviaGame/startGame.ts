import { SlashCommandBuilder } from '@discordjs/builders';
import { TriviaGame } from '@marquinhos/games';
import { TriviaDifficulty } from '@marquinhos/types';
import { delay } from '@marquinhos/utils/delay';
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

    for (let index = 1; index <= 2; index++) {
      const question = await game.askQuestion();
      const questionEmbed = await interaction.channel?.send({
        embeds: [
          new EmbedBuilder()
            .setDescription(
              `**${question.question}**\n\nPlayers que responderam:`
            )
            .setTitle(`Questão ${index}`),
        ],
      });
      game.currentQuestionEmbed = questionEmbed;
      await delay(10000);
      await countdown(interaction, 5);
      game.currentQuestion = null;
      game.intervalBetweenQuestions = true;
      await questionEmbed?.edit({
        embeds: [
          new EmbedBuilder()
            .setDescription(`${questionEmbed.embeds[0].description}`)
            .setTitle(questionEmbed.embeds[0].title)
            .setFooter({
              text: 'Tempo esgotado',
            }),
        ],
      });
      const intervalMessage = await interaction.channel?.send(
        'Intervalo, próxima questão em 5 segundos'
      );
      await delay(5000);
      game.intervalBetweenQuestions = false;
      await intervalMessage?.delete();
      await questionEmbed?.delete();
    }
    const players = await game.endGame();
    await triviaGames.delete(interaction.channelId);

    interaction.channel?.send({
      embeds: [
        new EmbedBuilder()
          .setTitle('Fim da partida')
          .setDescription(
            `**Parabéns ao vencedor: <@${
              players[0].id
            }>**\n\n**Pontuação:**\n${players
              .map((player) => `<@${player.id}>: ${player.points}`)
              .join('\n')}`
          ),
      ],
    });
  },
};

async function countdown(
  interaction: CommandInteraction,
  seconds: number
): Promise<void> {
  const message = await interaction.channel?.send(
    `Você tem ${seconds} segundos para responder`
  );

  for (let counter = seconds - 1; counter > 0; counter--) {
    await delay(1000);
    await message?.edit(`Você tem ${counter} segundos para responder`);
  }
  await delay(1000);
  await message?.delete();
}
