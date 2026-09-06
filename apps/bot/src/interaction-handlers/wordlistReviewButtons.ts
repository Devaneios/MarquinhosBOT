import {
  buildWordlistReviewActionRow,
  buildWordlistReviewContent,
  WORDLIST_REVIEW_BUTTON_ID_SET,
  WORDLIST_REVIEW_BUTTON_IDS,
} from '@marquinhos/commands/admin/wordlistReviewResponse';
import { MarquinhosApiService } from '@marquinhos/services/marquinhosApi';
import {
  InteractionHandler,
  InteractionHandlerTypes,
} from '@sapphire/framework';
import { ButtonInteraction } from 'discord.js';

const api = MarquinhosApiService.getInstance();

export class WordlistReviewButtonsHandler extends InteractionHandler {
  public constructor(ctx: InteractionHandler.LoaderContext) {
    super(ctx, { interactionHandlerType: InteractionHandlerTypes.Button });
  }

  override parse(interaction: ButtonInteraction) {
    if (WORDLIST_REVIEW_BUTTON_ID_SET.has(interaction.customId))
      return this.some();
    return this.none();
  }

  override async run(btn: ButtonInteraction) {
    await btn.deferUpdate();

    const word = btn.message.content.match(/`(.+)`/)?.[1];
    if (!word) {
      await btn.editReply({ content: '❌ Palavra atual não encontrada.' });
      return;
    }

    const decision =
      btn.customId === WORDLIST_REVIEW_BUTTON_IDS.remove ? 'remove' : 'keep';

    const response = await api.submitWordlistReviewDecision(word, decision);
    await btn.editReply({
      content: buildWordlistReviewContent(response.data),
      components: response.data.done ? [] : [buildWordlistReviewActionRow()],
    });
  }
}
