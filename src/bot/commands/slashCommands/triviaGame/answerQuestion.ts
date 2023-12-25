import { SlashCommandBuilder } from '@discordjs/builders';
import { TriviaGame } from '@marquinhos/games';
import { Client, CommandInteraction } from 'discord.js';

export const answerTriviaQuestion = {
  command: new SlashCommandBuilder()
    .setName('responder-trivia')
    .setDescription('Responde uma questão de trivia')
    .addStringOption((option) =>
      option.setName('resposta').setDescription('Resposta').setRequired(true)
    ),
  execute: async (interaction: CommandInteraction) => {
    const answer = interaction.options.get('resposta').value as string;

    const { triviaGames } = interaction.guild?.client as Client;
    const currentGame: TriviaGame = triviaGames.get(interaction.channelId);
    if (!currentGame) {
      return interaction.reply({
        content: 'Não existe um jogo de trivia nesse canal',
        ephemeral: true,
      });
    }
    const questionAswered = await currentGame.playerAnswer(
      interaction.user.id,
      answer
    );
    if (questionAswered) {
      return interaction.reply({
        content: 'Resposta enviada com sucesso',
        ephemeral: true,
      });
    }
    return interaction.reply({
      content: 'Houve um erro ao enviar sua resposta',
      ephemeral: true,
    });
  },
};
