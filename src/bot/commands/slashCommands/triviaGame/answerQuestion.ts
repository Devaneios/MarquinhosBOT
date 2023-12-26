import { SlashCommandBuilder } from '@discordjs/builders';
import { TriviaGame } from '@marquinhos/games';
import { Client, CommandInteraction, EmbedBuilder } from 'discord.js';

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
      answer,
      interaction.user.id
    );

    switch (questionAswered) {
      case 'questionNotFound':
        await interaction.reply({
          content: 'Não existe uma questão sendo feita no momento',
          ephemeral: true,
        });
        break;
      case 'alreadyAnswered':
        await interaction.reply({
          content: 'Você já respondeu essa questão',
          ephemeral: true,
        });
        break;
      case 'answered':
        await interaction.reply({
          content: 'Resposta enviada com sucesso',
          ephemeral: true,
        });

        await currentGame.currentQuestionEmbed.edit({
          embeds: [
            new EmbedBuilder()
              .setDescription(
                `${currentGame.currentQuestionEmbed.embeds[0].description}\n <@${interaction.user.id}>`
              )
              .setTitle(currentGame.currentQuestionEmbed.embeds[0].title),
          ],
        });
        break;
      case 'timeOut':
        await interaction.reply({
          content: 'Tempo esgotado',
          ephemeral: true,
        });
        break;
      default:
        await interaction.reply({
          content: 'Erro ao responder a questão',
          ephemeral: true,
        });
        break;
    }
  },
};
