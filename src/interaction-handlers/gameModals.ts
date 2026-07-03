import { GameManager } from '@marquinhos/game/core/GameManager';
import { handleGameInteraction } from '@marquinhos/lib/gameInteraction';
import {
  InteractionHandler,
  InteractionHandlerTypes,
} from '@sapphire/framework';
import {
  InteractionEditReplyOptions,
  MessageFlags,
  ModalSubmitInteraction,
} from 'discord.js';

const gameManager = GameManager.getInstance();

// ---------------------------------------------------------------------------
// Modal action parser for the dice game's bet-entry modals.
// ---------------------------------------------------------------------------

function legacyParseModal(
  modalId: string,
  value: string,
): Record<string, unknown> | null {
  switch (modalId) {
    case 'modal_dice_sum': {
      const sum = parseInt(value, 10);
      return isNaN(sum)
        ? null
        : { type: 'set_bet', betType: 'sum', betValue: sum };
    }
    case 'modal_dice_exact': {
      const num = parseInt(value, 10);
      return isNaN(num)
        ? null
        : { type: 'set_bet', betType: 'exact', betValue: num };
    }
    case 'modal_dice_even_odd': {
      const v = value.toLowerCase();
      if (v === 'par' || v === 'even')
        return { type: 'set_bet', betType: 'even_odd', betValue: 'even' };
      if (v === 'impar' || v === 'ímpar' || v === 'odd')
        return { type: 'set_bet', betType: 'even_odd', betValue: 'odd' };
      return null;
    }
    case 'modal_dice_high_low': {
      const v = value.toLowerCase();
      if (v === 'alto' || v === 'high')
        return { type: 'set_bet', betType: 'high_low', betValue: 'high' };
      if (v === 'baixo' || v === 'low')
        return { type: 'set_bet', betType: 'high_low', betValue: 'low' };
      return null;
    }
    default:
      return null;
  }
}

const GAME_MODAL_IDS = new Set([
  'modal_dice_sum',
  'modal_dice_exact',
  'modal_dice_even_odd',
  'modal_dice_high_low',
]);

export class GameModalsHandler extends InteractionHandler {
  public constructor(ctx: InteractionHandler.LoaderContext) {
    super(ctx, { interactionHandlerType: InteractionHandlerTypes.ModalSubmit });
  }

  override parse(interaction: ModalSubmitInteraction) {
    if (!interaction.channelId) return this.none();
    if (!GAME_MODAL_IDS.has(interaction.customId)) return this.none();
    return this.some();
  }

  override async run(modal: ModalSubmitInteraction) {
    if (!modal.channelId) return;
    const session = gameManager.getSessionByChannel(modal.channelId);
    if (!session) {
      await modal.reply({
        content: 'Esta partida já expirou.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const gameInstance = gameManager.getGameInstance(session.id);
    if (!gameInstance) {
      await modal.reply({
        content: 'Esta partida já expirou.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const value = modal.fields.getTextInputValue('input').trim();
    const action = legacyParseModal(modal.customId, value);

    if (!action) {
      await modal.reply({
        content: '❌ Entrada inválida. Tente novamente.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await modal.deferUpdate();
    await handleGameInteraction(
      modal.user.id,
      modal.channelId,
      action,
      (payload) => modal.editReply(payload as InteractionEditReplyOptions),
      (msg) =>
        modal
          .followUp({ content: msg, flags: MessageFlags.Ephemeral })
          .then(() => undefined),
    );
  }
}
