import { MarquinhosCommand } from '@marquinhos/lib/MarquinhosCommand';
import { MarquinhosApiService } from '@marquinhos/services/marquinhosApi';
import { baseEmbed } from '@marquinhos/utils/discord';
import { logger } from '@marquinhos/utils/logger';
import {
  buildKeyboardImage,
  type LetterFeedback,
} from '@marquinhos/utils/termoKeyboard';
import { Command } from '@sapphire/framework';
import {
  AttachmentBuilder,
  MessageFlags,
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
} from 'discord.js';

interface WordleGuessResult {
  guess: string;
  feedback: LetterFeedback[];
  guesses: { guess: string; feedback: LetterFeedback[] }[];
  solved: boolean;
  attempts: number;
  wordLength: number;
}

const api = MarquinhosApiService.getInstance();
const previousErrorInteractions = new Map<
  string,
  ChatInputCommandInteraction
>();

const SQUARE: Record<LetterFeedback, string> = {
  correct: '🟩',
  present: '🟨',
  absent: '⬛',
};

function feedbackToSquares(feedback: LetterFeedback[]): string {
  return feedback.map((f) => SQUARE[f]).join('');
}

export class TermoCommand extends MarquinhosCommand {
  public constructor(context: Command.LoaderContext) {
    super(context, { name: 'termo', cooldownDelay: 3_000 });
  }

  override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.commandName)
        .setDescription('Jogue o Terminhos, o Termo do Marquinhos!')
        .addStringOption((opt) =>
          opt
            .setName('palpite')
            .setDescription('Sua tentativa')
            .setAutocomplete(true),
        ),
    );
  }

  override async chatInputRun(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId) {
      await interaction.reply({
        content: '❌ O Terminhos só pode ser jogado no Devaneios.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const configResponse = await api.getWordleConfig(interaction.guildId);
    const channelId = (configResponse.data as { channelId?: string })
      ?.channelId;
    if (!channelId) {
      await interaction.reply({
        content: '❌ O Terminhos não está configurado.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const channel = await interaction
      .guild!.channels.fetch(channelId)
      .catch(() => null);
    if (!channel || !channel.isTextBased()) {
      await interaction.reply({
        content: '❌ O canal configurado para o Terminhos é inválido.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (channelId !== interaction.channelId) {
      await interaction.reply({
        content: `❌ Por favor, jogue o Terminhos no canal <#${channelId}>.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const userId = interaction.user.id;
    const prevError = previousErrorInteractions.get(userId);
    if (prevError) {
      prevError.deleteReply().catch(() => {
        logger.warn(
          `Termo: failed to delete previous error message for user ${userId}`,
        );
      });
      previousErrorInteractions.delete(userId);
    }

    const guess = interaction.options.getString('palpite', false)?.trim();
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (!guess) {
      const userAttemptsResponse = await api.getUserWordleSession(
        userId,
        interaction.guildId,
      );
      const result = userAttemptsResponse.data as {
        guesses: { guess: string; feedback: LetterFeedback[] }[];
        wordLength: number;
        attempts: number;
      } | null;
      if (!result) {
        await interaction.editReply({
          content: '❌ Você ainda não tentou nenhuma vez.',
        });
        return;
      }
      const keyboardBuffer = await buildKeyboardImage(
        result.guesses,
        result.wordLength,
        { maxAttempts: result.attempts },
      );
      const attachment = new AttachmentBuilder(keyboardBuffer, {
        name: 'keyboard.png',
      });
      const embed = baseEmbed(this.container.client);
      embed.setTitle('⬛🟨🟩 Terminhos');
      embed.setImage('attachment://keyboard.png');
      await interaction.editReply({ embeds: [embed], files: [attachment] });
      return;
    }

    let result: WordleGuessResult;
    try {
      const response = await api.submitWordleGuess(
        interaction.user.id,
        interaction.guildId,
        guess,
      );
      result = response.data as WordleGuessResult;
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'Erro ao processar tentativa.';
      await interaction.editReply({ content: `❌ ${message}` });
      previousErrorInteractions.set(userId, interaction);
      return;
    }

    previousErrorInteractions.delete(userId);
    const keyboardBuffer = await buildKeyboardImage(
      result.guesses,
      result.wordLength,
      { maxAttempts: result.attempts },
    );
    const attachment = new AttachmentBuilder(keyboardBuffer, {
      name: 'keyboard.png',
    });
    const embed = baseEmbed(this.container.client);
    embed.setTitle('⬛🟨🟩 Terminhos');
    embed.setImage('attachment://keyboard.png');

    if (result.solved) {
      embed.setDescription(
        `🎉 Você acertou em **${result.attempts}** tentativa${result.attempts > 1 ? 's' : ''}!`,
      );
      embed.setColor(0x57f287);
    }

    await interaction.editReply({ embeds: [embed], files: [attachment] });

    if (result.solved) {
      try {
        const cfgRes = await api.getWordleConfig(interaction.guildId);
        const chId = (cfgRes.data as { channelId?: string })?.channelId;
        if (!chId) return;
        const ch = await interaction
          .guild!.channels.fetch(chId)
          .catch(() => null);
        if (!ch || !ch.isTextBased()) return;
        const allSquares = result.guesses
          .map((g) => feedbackToSquares(g.feedback))
          .join('\n');
        const publicMsg = `${interaction.user} acertou o Terminho em ${result.attempts} tentativa${result.attempts > 1 ? 's' : ''}! 🎉\n${allSquares}`;
        await ch.send(publicMsg);
      } catch {
        /* silently ignore */
      }
    }
  }

  override async autocompleteRun(interaction: AutocompleteInteraction) {
    const guess = interaction.options.getFocused().trim();
    if (!guess || !interaction.guildId) {
      await interaction.respond([]);
      return;
    }
    try {
      const response = await api.validateWordleGuess(
        interaction.guildId,
        guess,
      );
      const result = response.data as {
        valid: boolean;
        wordLength: number;
        message: string;
      };
      if (!result.valid) {
        await interaction.respond([]);
        return;
      }
      await interaction.respond([{ name: guess, value: guess }]);
    } catch {
      await interaction.respond([]);
    }
  }
}
