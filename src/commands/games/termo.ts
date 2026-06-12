import { MarquinhosCommand } from '@marquinhos/lib/MarquinhosCommand';
import { MarquinhosApiService } from '@marquinhos/services/marquinhosApi';
import {
  buildResultImage,
  type LetterFeedback,
} from '@marquinhos/ui/screens/termo';
import { baseEmbed } from '@marquinhos/utils/discord';
import { logger } from '@marquinhos/utils/logger';
import { Command } from '@sapphire/framework';
import {
  AttachmentBuilder,
  GuildMember,
  MessageFlags,
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { buildKeyboardAttachment, buildTermoActionRow } from './termoResponse';

interface WordleGuessResult {
  guesses: { guess: string; feedback: LetterFeedback[] }[];
  solved: boolean;
  attempts: number;
  wordLength: number;
  streak?: number;
}

const api = MarquinhosApiService.getInstance();
const previousErrorInteractions = new Map<
  string,
  ChatInputCommandInteraction
>();

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
    await this.handleJogar(interaction);
  }

  private async handleJogar(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    if (!interaction.guildId) {
      await interaction.reply({
        content: '❌ O Terminhos só pode ser jogado no Devaneios.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const configResponse = await api.getWordleConfig(interaction.guildId);
    const channelId = (configResponse.data as { channelId?: string })
      ?.channelId;
    if (!channelId) {
      await interaction.editReply({
        content: '❌ O Terminhos não está configurado.',
      });
      return;
    }

    const channel = await interaction
      .guild!.channels.fetch(channelId)
      .catch(() => null);
    if (!channel || !channel.isTextBased()) {
      await interaction.editReply({
        content: '❌ O canal configurado para o Terminhos é inválido.',
      });
      return;
    }

    if (channelId !== interaction.channelId) {
      await interaction.editReply({
        content: `❌ Por favor, jogue o Terminhos no canal <#${channelId}>.`,
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
      const attachment = await buildKeyboardAttachment(
        result.guesses,
        result.wordLength,
        { maxAttempts: result.attempts },
      );
      await interaction.editReply({
        files: [attachment],
        components: [buildTermoActionRow()],
      });
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
    const attachment = await buildKeyboardAttachment(
      result.guesses,
      result.wordLength,
      {
        maxAttempts: result.attempts,
        status: result.solved ? { attempts: result.attempts } : undefined,
      },
    );

    await interaction.editReply({
      files: [attachment],
      components: [buildTermoActionRow()],
    });

    if (result.solved) {
      try {
        const resultBuffer = await buildResultImage(result.guesses);
        const resultAttachment = new AttachmentBuilder(resultBuffer, {
          name: 'resultado.png',
        });
        const name =
          (interaction.member as GuildMember).nickname ||
          interaction.user.displayName ||
          interaction.user.username ||
          interaction.user.globalName;

        const solvedMessage =
          result.attempts === 1
            ? 'acertou de primeira!'
            : `acertou em ${result.attempts} tentativa${result.attempts > 1 ? 's' : ''}!`;

        const embed = baseEmbed(this.container.client)
          .setTitle(`${name} ${solvedMessage}`)
          .setColor(0x588157)
          .setImage('attachment://resultado.png');

        await channel.send({
          embeds: [embed],
          files: [resultAttachment],
        });

        if (result.guesses.length === 1) {
          const msg = await channel.send(
            `TAPORRA ${name} EU NUNCA ACREDITEI! ESPERO QUE NUNCA MAIS CONSIGA!`,
          );
          msg.react(':marquinhosverao:1192666622356361367');
        } else if (result.guesses.length === 2) {
          const msg = await channel.send(
            `OLOCO ${name} QUASE HEIN! DA PRÓXIMA VAI SER NO MÍNIMO 5!`,
          );
          msg.react(':marquinhosverao:1192666622356361367');
        }
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
    if (guess.length < 5 || guess.length > 6) {
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
