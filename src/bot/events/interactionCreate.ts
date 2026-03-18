import { GameManager } from '@marquinhos/game/core/GameManager';
import { BotEvent } from '@marquinhos/types';
import BotError from '@marquinhos/utils/botError';
import { logger } from '@marquinhos/utils/logger';
import { XPSystem } from '@marquinhos/utils/xpSystem';
import { useMainPlayer } from 'discord-player';
import {
  ActionRowBuilder,
  AutocompleteInteraction,
  ButtonInteraction,
  CommandInteraction,
  Guild,
  MessageFlags,
  ModalBuilder,
  ModalSubmitInteraction,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';

const gameManager = GameManager.getInstance();

/** Maps a button customId to a game action object, or null if a modal is needed. */
function parseButtonAction(customId: string): Record<string, any> | null {
  // Blackjack
  if (customId === 'bj_hit') return { type: 'hit' };
  if (customId === 'bj_stand') return { type: 'stand' };
  if (customId === 'bj_double') return { type: 'double' };

  // Slots
  if (customId === 'slots_spin') return { type: 'spin' };
  if (customId === 'slots_bet_down') return { type: 'bet_down' };
  if (customId === 'slots_bet_up') return { type: 'bet_up' };

  // Dice
  if (customId === 'dice_roll') return { type: 'roll' };
  if (customId === 'dice_cancel_bet') return { type: 'cancel_bet' };
  if (customId === 'dice_bet_sum') return null;
  if (customId === 'dice_bet_exact') return null;
  if (customId === 'dice_bet_even_odd') return null;
  if (customId === 'dice_bet_high_low') return null;
  if (customId.startsWith('dice_count_')) {
    const count = parseInt(customId.replace('dice_count_', ''), 10);
    return { type: 'change_dice_count', count };
  }

  // Roulette
  if (customId === 'roulette_trigger') return { type: 'pull_trigger' };
  if (customId === 'roulette_spin') return { type: 'spin_chamber' };

  // Lottery
  if (customId === 'lottery_quick_pick') return { type: 'quick_pick' };
  if (customId === 'lottery_clear') return { type: 'clear_numbers' };
  if (customId === 'lottery_draw') return { type: 'draw' };
  if (customId === 'lottery_page_prev') return { type: 'page_prev' };
  if (customId === 'lottery_page_next') return { type: 'page_next' };
  if (customId.startsWith('lottery_select_')) {
    const number = parseInt(customId.replace('lottery_select_', ''), 10);
    return { type: 'select_number', number };
  }

  // TicTacToe
  if (customId.startsWith('ttt_move_')) {
    const parts = customId.split('_');
    return {
      type: 'move',
      row: parseInt(parts[2], 10),
      col: parseInt(parts[3], 10),
    };
  }

  // Rock Paper Scissors
  if (customId === 'rps_rock') return { type: 'choose', choice: 'rock' };
  if (customId === 'rps_paper') return { type: 'choose', choice: 'paper' };
  if (customId === 'rps_scissors')
    return { type: 'choose', choice: 'scissors' };

  // Maze
  if (customId === 'maze_up') return { type: 'move', direction: 'up' };
  if (customId === 'maze_down') return { type: 'move', direction: 'down' };
  if (customId === 'maze_left') return { type: 'move', direction: 'left' };
  if (customId === 'maze_right') return { type: 'move', direction: 'right' };
  if (customId === 'maze_setup_size_15') return { type: 'setup_size', size: 15 };
  if (customId === 'maze_setup_size_31') return { type: 'setup_size', size: 31 };
  if (customId === 'maze_setup_size_51') return { type: 'setup_size', size: 51 };
  if (customId === 'maze_setup_size_99') return { type: 'setup_size', size: 99 };
  if (customId === 'maze_setup_mode_open') return { type: 'setup_mode', mode: 'open' };
  if (customId === 'maze_setup_mode_foggy') return { type: 'setup_mode', mode: 'foggy' };

  // MusicQuiz
  if (customId.startsWith('quiz_answer_')) {
    return {
      type: 'answer',
      answer: parseInt(customId.replace('quiz_answer_', ''), 10),
    };
  }

  // Geography
  if (customId.startsWith('geo_answer_')) {
    return {
      type: 'answer',
      answer: parseInt(customId.replace('geo_answer_', ''), 10),
    };
  }
  if (customId === 'geo_hint') return { type: 'hint' };

  // Pop Culture
  if (customId.startsWith('pop_answer_')) {
    return {
      type: 'answer',
      answer: parseInt(customId.replace('pop_answer_', ''), 10),
    };
  }

  // Brazil History
  if (customId.startsWith('history_answer_')) {
    return {
      type: 'answer',
      answer: parseInt(customId.replace('history_answer_', ''), 10),
    };
  }

  // SecretWord
  if (customId.startsWith('word_letter_')) {
    return {
      type: 'guess_letter',
      letter: customId.replace('word_letter_', ''),
    };
  }
  if (customId === 'word_guess_complete') return null;

  // Anagram
  if (customId === 'anagram_hint') return { type: 'hint' };
  if (customId === 'anagram_guess') return null;

  // Rhyme
  if (customId === 'rhyme_input') return null;

  // Translate
  if (customId === 'translate_answer') return null;

  // TreasureHunt
  if (customId === 'hunt_hint') return { type: 'hint' };
  if (customId === 'hunt_answer') return null;

  // SecretCode
  if (customId === 'secret_code_guess') return null;

  // SpeedMath
  if (customId === 'speed_math_answer') return null;

  // BattleRoyale
  if (customId === 'battle_royale_respond') return null;

  return { type: customId };
}

/** Shows the appropriate Discord modal for a text-input game action. */
async function showGameModal(
  btn: ButtonInteraction,
  customId: string,
): Promise<void> {
  type ModalCfg = {
    title: string;
    label: string;
    placeholder: string;
    modalId: string;
  };
  const configs: Record<string, ModalCfg> = {
    word_guess_complete: {
      title: 'Adivinhar a Palavra',
      label: 'Digite a palavra completa',
      placeholder: 'Ex: COMPUTADOR',
      modalId: 'modal_secret_word',
    },
    anagram_guess: {
      title: 'Resolver Anagrama',
      label: 'Palavra desembaralhada',
      placeholder: 'Ex: AMOR',
      modalId: 'modal_anagram',
    },
    rhyme_input: {
      title: 'Rima Rápida',
      label: 'Uma palavra que rima',
      placeholder: 'Ex: DOR',
      modalId: 'modal_rhyme',
    },
    translate_answer: {
      title: 'Tradução',
      label: 'Digite a tradução',
      placeholder: 'Ex: OLÁ MUNDO',
      modalId: 'modal_translate',
    },
    hunt_answer: {
      title: 'Resposta do Enigma',
      label: 'Sua resposta',
      placeholder: 'Ex: SOL',
      modalId: 'modal_treasure_hunt',
    },
    secret_code_guess: {
      title: 'Código Secreto',
      label: '4 dígitos de 1 a 6 sem repetir',
      placeholder: 'Ex: 1 2 3 4',
      modalId: 'modal_secret_code',
    },
    speed_math_answer: {
      title: 'Speed Math',
      label: 'Resultado',
      placeholder: 'Digite o número',
      modalId: 'modal_speed_math',
    },
    battle_royale_respond: {
      title: 'Sua Resposta',
      label: 'Responda o desafio',
      placeholder: 'Digite sua resposta',
      modalId: 'modal_battle_royale',
    },
    dice_bet_sum: {
      title: 'Apostar na Soma',
      label: 'Soma alvo',
      placeholder: 'Ex: 7',
      modalId: 'modal_dice_sum',
    },
    dice_bet_exact: {
      title: 'Número Exato',
      label: 'Número (1-6)',
      placeholder: 'Ex: 4',
      modalId: 'modal_dice_exact',
    },
    dice_bet_even_odd: {
      title: 'Par ou Ímpar',
      label: 'par ou impar',
      placeholder: 'par / impar',
      modalId: 'modal_dice_even_odd',
    },
    dice_bet_high_low: {
      title: 'Alto ou Baixo',
      label: 'alto ou baixo',
      placeholder: 'alto / baixo',
      modalId: 'modal_dice_high_low',
    },
  };

  const cfg = configs[customId];
  if (!cfg) return;

  const modal = new ModalBuilder().setCustomId(cfg.modalId).setTitle(cfg.title);
  const input = new TextInputBuilder()
    .setCustomId('input')
    .setLabel(cfg.label)
    .setPlaceholder(cfg.placeholder)
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(100);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(input),
  );
  await btn.showModal(modal);
}

/** Parses a modal submission into a game action object. */
function parseModalAction(
  modalId: string,
  value: string,
): Record<string, any> | null {
  value = value.trim();

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

/** Returns all interactive Discord components for the current game state. */
function getGameComponents(gameInstance: any): any[] {
  const components: any[] = [];

  const buttonMethods = [
    'getActionButtons',
    'getAnswerButtons',
    'getChoiceButtons',
    'getBoardButtons',
    'getMovementButtons',
    'getBetButtons',
    'getLetterButtons',
    'getNumberButtons',
  ];

  for (const method of buttonMethods) {
    if (typeof gameInstance[method] === 'function') {
      const rows = gameInstance[method]();
      if (rows && rows.length > 0) {
        components.push(...rows);
      }
    }
  }

  // Discord allows a maximum of 5 action rows per message
  return components.slice(0, 5);
}

async function handleGameInteraction(
  userId: string,
  channelId: string,
  action: Record<string, any>,
  updateFn: (payload: { embeds: any[]; components: any[] }) => Promise<unknown>,
  errorFn: (msg: string) => Promise<void>,
): Promise<void> {
  const session = gameManager.getSessionByChannel(channelId);
  if (!session) return;

  const gameInstance = gameManager.getGameInstance(session.id);
  if (!gameInstance) return;

  try {
    await gameInstance.handlePlayerAction(userId, action);

    if (gameInstance.isFinished()) {
      const result = await gameInstance.finish();
      await gameManager.endSessionWithResult(session.id, result);
      const finalEmbed = gameInstance.getGameEmbed();
      await updateFn({ embeds: [finalEmbed], components: [] });
    } else {
      const embed = gameInstance.getGameEmbed();
      const components = getGameComponents(gameInstance);
      await updateFn({ embeds: [embed], components });
    }
  } catch (error) {
    console.error('Game interaction error:', error);
    await errorFn('Ocorreu um erro ao processar sua ação. Tente novamente.');
  }
}

export const interactionCreate: BotEvent = {
  name: 'interactionCreate',
  execute: async (interaction: CommandInteraction) => {
    if (interaction.isChatInputCommand()) {
      const timedMessageDuration = 10000;
      const command = interaction.client.slashCommands.get(
        interaction.commandName,
      );
      const cooldown = interaction.client.cooldowns.get(
        `${interaction.commandName}-${interaction.user.username}`,
      );
      if (!command) return;
      if (command.cooldown && cooldown) {
        if (Date.now() < cooldown) {
          interaction.reply(
            `Vai com calma! Você pode usar esse comando novamente daqui ${Math.floor(
              Math.abs(Date.now() - cooldown) / 1000,
            )} segundos.`,
          );
          setTimeout(() => interaction.deleteReply(), timedMessageDuration);
          return;
        }
        interaction.client.cooldowns.set(
          `${interaction.commandName}-${interaction.user.username}`,
          Date.now() + command.cooldown * 1000,
        );
        setTimeout(() => {
          interaction.client.cooldowns.delete(
            `${interaction.commandName}-${interaction.user.username}`,
          );
        }, command.cooldown * 1000);
      } else if (command.cooldown && !cooldown) {
        interaction.client.cooldowns.set(
          `${interaction.commandName}-${interaction.user.username}`,
          Date.now() + command.cooldown * 1000,
        );
      }

      logger.info(
        `${interaction.user.username} executing command: ${
          interaction.commandName
        } ${
          interaction.options
            ? interaction.options.data.map((option) => option.value).join(' ')
            : ''
        }`,
      );
      if (command.validators?.length) {
        for (const validator of command.validators) {
          if (!(await validator(interaction))) return;
        }
      }

      const player = useMainPlayer();

      const data = {
        guild: interaction.guild as Guild,
      };

      player.context.provide(data, async () => {
        await command.execute(interaction);

        // Level-up and achievement notifications come directly from the addXP
        // API response — no separate polling call needed.
        await XPSystem.addCommandXP(interaction);
      });
    } else if (interaction.isButton()) {
      const btn = interaction as ButtonInteraction;

      // Check if there's an active game in this channel
      const session = gameManager.getSessionByChannel(btn.channelId);
      if (!session) return;
      const gameInstance = gameManager.getGameInstance(session.id);
      if (!gameInstance) return;

      const action = parseButtonAction(btn.customId);

      if (action === null) {
        // This button should open a modal for text input
        try {
          await showGameModal(btn, btn.customId);
        } catch (error) {
          console.error('Error showing game modal:', error);
        }
        return;
      }

      await btn.deferUpdate();

      await handleGameInteraction(
        btn.user.id,
        btn.channelId,
        action,
        (payload) => btn.editReply(payload),
        (msg) => btn.followUp({ content: msg, flags: MessageFlags.Ephemeral }).then(() => {}),
      );
    } else if ((interaction as any).isModalSubmit?.()) {
      const modal = interaction as unknown as ModalSubmitInteraction;

      const session = gameManager.getSessionByChannel(modal.channelId);
      if (!session) return;
      const gameInstance = gameManager.getGameInstance(session.id);
      if (!gameInstance) return;

      const value = modal.fields.getTextInputValue('input');
      const action = parseModalAction(modal.customId, value);

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
        (payload) => modal.editReply(payload),
        (msg) =>
          modal.followUp({ content: msg, flags: MessageFlags.Ephemeral }).then(() => {}),
      );
    } else if (interaction.isAutocomplete()) {
      const command = (
        interaction as AutocompleteInteraction
      ).client.slashCommands.get(
        (interaction as AutocompleteInteraction).commandName,
      );
      if (!command) {
        throw new BotError(
          `No command matching ${(interaction as AutocompleteInteraction).commandName} was found.`,
          interaction,
          'error',
        );
      }
      try {
        if (!command.autocomplete) return;
        command.autocomplete(interaction);
      } catch (error: unknown) {
        throw new BotError(
          `An error occurred while executing the autocomplete for ${(interaction as AutocompleteInteraction).commandName}.
Error: ${(error as Error).message}`,
          interaction,
          'error',
        );
      }
    }
  },
};
