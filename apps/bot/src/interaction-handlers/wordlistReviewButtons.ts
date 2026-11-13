import {
  buildWordlistReviewActionRow,
  buildWordlistReviewContent,
  WORDLIST_REVIEW_BUTTON_ID_SET,
  WORDLIST_REVIEW_BUTTON_IDS,
} from '@marquinhos/commands/admin/wordlistReviewResponse';
import { isDevelopmentChannelAllowed } from '@marquinhos/config/developmentScope';
import { MarquinhosApiService } from '@marquinhos/services/marquinhosApi';
import { logger } from '@marquinhos/utils/logger';
import {
  InteractionHandler,
  InteractionHandlerTypes,
} from '@sapphire/framework';
import {
  ButtonInteraction,
  MessageFlags,
  PermissionFlagsBits,
} from 'discord.js';

const api = MarquinhosApiService.getInstance();

export class WordlistReviewButtonsHandler extends InteractionHandler {
  public constructor(ctx: InteractionHandler.LoaderContext) {
    super(ctx, { interactionHandlerType: InteractionHandlerTypes.Button });
  }

  override parse(interaction: ButtonInteraction) {
    if (!isDevelopmentChannelAllowed(interaction)) return this.none();
    if (WORDLIST_REVIEW_BUTTON_ID_SET.has(interaction.customId))
      return this.some();
    return this.none();
  }

  override async run(btn: ButtonInteraction) {
    if (!btn.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await btn.reply({
        content: '❌ Somente administradores podem revisar a wordlist.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await btn.deferUpdate();

    const word = btn.message.content.match(/`(.+)`/)?.[1];
    if (!word) {
      await btn.editReply({ content: '❌ Palavra atual não encontrada.' });
      return;
    }

    const decision =
      btn.customId === WORDLIST_REVIEW_BUTTON_IDS.remove ? 'remove' : 'keep';

    try {
      const response = await api.submitWordlistReviewDecision(word, decision);
      await btn.editReply({
        content: buildWordlistReviewContent(response.data),
        components: response.data.done ? [] : [buildWordlistReviewActionRow()],
      });
    } catch (error) {
      logger.warn('wordlist review button failed:', error);
      await btn.editReply({
        content: '❌ Erro ao registrar decisão da wordlist.',
      });
    }
  }
}
