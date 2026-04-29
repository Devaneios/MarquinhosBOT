import {
  buildKeyboardAttachment,
  buildTermoActionRow,
  TERMO_BUTTON_ID_SET,
  TERMO_BUTTON_IDS,
} from '@marquinhos/commands/games/termoResponse';
import { MarquinhosApiService } from '@marquinhos/services/marquinhosApi';
import { formatGuessesAsText } from '@marquinhos/ui/compounds/termo/text-fallback';
import type { LetterFeedback } from '@marquinhos/ui/screens/termo';
import {
  InteractionHandler,
  InteractionHandlerTypes,
} from '@sapphire/framework';
import { ButtonInteraction, MessageFlags } from 'discord.js';

type TermoSessionData = {
  guesses: { guess: string; feedback: LetterFeedback[] }[];
  wordLength: number;
  attempts: number;
} | null;

const api = MarquinhosApiService.getInstance();

export class TermoButtonsHandler extends InteractionHandler {
  public constructor(ctx: InteractionHandler.LoaderContext) {
    super(ctx, { interactionHandlerType: InteractionHandlerTypes.Button });
  }

  override parse(interaction: ButtonInteraction) {
    if (TERMO_BUTTON_ID_SET.has(interaction.customId)) return this.some();
    return this.none();
  }

  override async run(btn: ButtonInteraction) {
    if (!btn.guildId) return;

    if (btn.customId === TERMO_BUTTON_IDS.link) {
      const url = btn.message.attachments.first()?.url;
      await btn.reply({
        content: url ?? '❌ URL da imagem não disponível.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await btn.deferUpdate();

    const response = await api.getUserWordleSession(btn.user.id, btn.guildId);
    const result = response.data as TermoSessionData;

    if (!result || result.guesses.length === 0) {
      await btn.editReply({ content: '❌ Você ainda não tentou nenhuma vez.' });
      return;
    }

    if (btn.customId === TERMO_BUTTON_IDS.text) {
      const text = formatGuessesAsText(result.guesses);
      await btn.editReply({ content: `**Suas tentativas:**\n${text}` });
      return;
    }

    if (btn.customId === TERMO_BUTTON_IDS.retry) {
      const attachment = await buildKeyboardAttachment(
        result.guesses,
        result.wordLength,
        { maxAttempts: result.attempts },
      );
      await btn.editReply({
        content: '',
        files: [attachment],
        attachments: [],
        components: [buildTermoActionRow()],
      });
    }
  }
}
