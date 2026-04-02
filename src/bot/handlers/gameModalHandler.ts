import { handleGameInteraction } from '@marquinhos/bot/handlers/gameInteraction';
import { GameManager } from '@marquinhos/game/core/GameManager';
import {
  InteractionEditReplyOptions,
  MessageFlags,
  ModalSubmitInteraction,
} from 'discord.js';

const gameManager = GameManager.getInstance();

// ---------------------------------------------------------------------------
// Legacy modal action parser — backwards-compat for the 20 existing games.
// New games implement parseModal() on their class instead.
// ---------------------------------------------------------------------------

function legacyParseModal(
  modalId: string,
  value: string,
): Record<string, unknown> | null {
  switch (modalId) {
    case 'modal_secret_word':
      return { type: 'guess_word', word: value };
    case 'modal_anagram':
      return { type: 'guess', word: value };
    case 'modal_rhyme':
      return { type: 'rhyme', word: value };
    case 'modal_translate':
      return { type: 'translate', translation: value };
    case 'modal_treasure_hunt':
      return { type: 'solve', answer: value };
    case 'modal_secret_code': {
      const digits = value
        .replace(/\s+/g, '')
        .split('')
        .map(Number)
        .filter((n) => !isNaN(n));
      return { type: 'guess', code: digits };
    }
    case 'modal_speed_math': {
      const answer = parseFloat(value);
      return isNaN(answer) ? null : { type: 'answer', answer };
    }
    case 'modal_battle_royale':
      return { type: 'respond', response: value };
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

// ---------------------------------------------------------------------------
// Public handler
// ---------------------------------------------------------------------------

export async function handleModalSubmitInteraction(
  modal: ModalSubmitInteraction,
): Promise<void> {
  if (!modal.channelId) return;

  const session = gameManager.getSessionByChannel(modal.channelId);
  if (!session) return;
  const gameInstance = gameManager.getGameInstance(session.id);
  if (!gameInstance) return;

  const value = modal.fields.getTextInputValue('input').trim();

  // Try new API first (game owns its modal parsing)
  let action: Record<string, unknown> | null = gameInstance.parseModal(
    modal.customId,
    value,
  );

  // Fall through to legacy switch for the 20 existing games
  if (!action) action = legacyParseModal(modal.customId, value);

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
