import { handleGameInteraction } from '@marquinhos/bot/handlers/gameInteraction';
import { GameManager } from '@marquinhos/game/core/GameManager';
import {
  ButtonDescriptor,
  ButtonResult,
  ModalConfig,
} from '@marquinhos/game/core/GameTypes';
import {
  ActionRowBuilder,
  ButtonInteraction,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';

const gameManager = GameManager.getInstance();

// ---------------------------------------------------------------------------
// Legacy dispatch tables — backwards-compat layer for the 20 existing games.
// New games declare getButtonDescriptors() on their class instead.
// ---------------------------------------------------------------------------

const STATIC_BUTTONS = new Map<string, ButtonResult>([
  // Blackjack
  ['bj_hit', { kind: 'action', action: { type: 'hit' } }],
  ['bj_stand', { kind: 'action', action: { type: 'stand' } }],
  ['bj_double', { kind: 'action', action: { type: 'double' } }],
  // Slots
  ['slots_spin', { kind: 'action', action: { type: 'spin' } }],
  ['slots_bet_down', { kind: 'action', action: { type: 'bet_down' } }],
  ['slots_bet_up', { kind: 'action', action: { type: 'bet_up' } }],
  // Dice
  ['dice_roll', { kind: 'action', action: { type: 'roll' } }],
  ['dice_cancel_bet', { kind: 'action', action: { type: 'cancel_bet' } }],
  [
    'dice_bet_sum',
    {
      kind: 'modal',
      config: {
        modalId: 'modal_dice_sum',
        title: 'Apostar na Soma',
        label: 'Soma alvo',
        placeholder: 'Ex: 7',
      },
    },
  ],
  [
    'dice_bet_exact',
    {
      kind: 'modal',
      config: {
        modalId: 'modal_dice_exact',
        title: 'Número Exato',
        label: 'Número (1-6)',
        placeholder: 'Ex: 4',
      },
    },
  ],
  [
    'dice_bet_even_odd',
    {
      kind: 'modal',
      config: {
        modalId: 'modal_dice_even_odd',
        title: 'Par ou Ímpar',
        label: 'par ou impar',
        placeholder: 'par / impar',
      },
    },
  ],
  [
    'dice_bet_high_low',
    {
      kind: 'modal',
      config: {
        modalId: 'modal_dice_high_low',
        title: 'Alto ou Baixo',
        label: 'alto ou baixo',
        placeholder: 'alto / baixo',
      },
    },
  ],
  // Roulette
  ['roulette_trigger', { kind: 'action', action: { type: 'pull_trigger' } }],
  ['roulette_spin', { kind: 'action', action: { type: 'spin_chamber' } }],
  // Lottery
  ['lottery_quick_pick', { kind: 'action', action: { type: 'quick_pick' } }],
  ['lottery_clear', { kind: 'action', action: { type: 'clear_numbers' } }],
  ['lottery_draw', { kind: 'action', action: { type: 'draw' } }],
  ['lottery_page_prev', { kind: 'action', action: { type: 'page_prev' } }],
  ['lottery_page_next', { kind: 'action', action: { type: 'page_next' } }],
  // Rock Paper Scissors
  ['rps_rock', { kind: 'action', action: { type: 'choose', choice: 'rock' } }],
  [
    'rps_paper',
    { kind: 'action', action: { type: 'choose', choice: 'paper' } },
  ],
  [
    'rps_scissors',
    { kind: 'action', action: { type: 'choose', choice: 'scissors' } },
  ],
  // Maze
  ['maze_up', { kind: 'action', action: { type: 'move', direction: 'up' } }],
  [
    'maze_down',
    { kind: 'action', action: { type: 'move', direction: 'down' } },
  ],
  [
    'maze_left',
    { kind: 'action', action: { type: 'move', direction: 'left' } },
  ],
  [
    'maze_right',
    { kind: 'action', action: { type: 'move', direction: 'right' } },
  ],
  [
    'maze_setup_size_15',
    { kind: 'action', action: { type: 'setup_size', size: 15 } },
  ],
  [
    'maze_setup_size_31',
    { kind: 'action', action: { type: 'setup_size', size: 31 } },
  ],
  [
    'maze_setup_size_51',
    { kind: 'action', action: { type: 'setup_size', size: 51 } },
  ],
  [
    'maze_setup_size_99',
    { kind: 'action', action: { type: 'setup_size', size: 99 } },
  ],
  [
    'maze_setup_mode_open',
    { kind: 'action', action: { type: 'setup_mode', mode: 'open' } },
  ],
  [
    'maze_setup_mode_foggy',
    { kind: 'action', action: { type: 'setup_mode', mode: 'foggy' } },
  ],
  // Geography
  ['geo_hint', { kind: 'action', action: { type: 'hint' } }],
  // SecretWord
  [
    'word_guess_complete',
    {
      kind: 'modal',
      config: {
        modalId: 'modal_secret_word',
        title: 'Adivinhar a Palavra',
        label: 'Digite a palavra completa',
        placeholder: 'Ex: COMPUTADOR',
      },
    },
  ],
  // Anagram
  ['anagram_hint', { kind: 'action', action: { type: 'hint' } }],
  [
    'anagram_guess',
    {
      kind: 'modal',
      config: {
        modalId: 'modal_anagram',
        title: 'Resolver Anagrama',
        label: 'Palavra desembaralhada',
        placeholder: 'Ex: AMOR',
      },
    },
  ],
  // Rhyme
  [
    'rhyme_input',
    {
      kind: 'modal',
      config: {
        modalId: 'modal_rhyme',
        title: 'Rima Rápida',
        label: 'Uma palavra que rima',
        placeholder: 'Ex: DOR',
      },
    },
  ],
  // Translate
  [
    'translate_answer',
    {
      kind: 'modal',
      config: {
        modalId: 'modal_translate',
        title: 'Tradução',
        label: 'Digite a tradução',
        placeholder: 'Ex: OLÁ MUNDO',
      },
    },
  ],
  // TreasureHunt
  ['hunt_hint', { kind: 'action', action: { type: 'hint' } }],
  [
    'hunt_answer',
    {
      kind: 'modal',
      config: {
        modalId: 'modal_treasure_hunt',
        title: 'Resposta do Enigma',
        label: 'Sua resposta',
        placeholder: 'Ex: SOL',
      },
    },
  ],
  // SecretCode
  [
    'secret_code_guess',
    {
      kind: 'modal',
      config: {
        modalId: 'modal_secret_code',
        title: 'Código Secreto',
        label: '4 dígitos de 1 a 6 sem repetir',
        placeholder: 'Ex: 1 2 3 4',
      },
    },
  ],
  // SpeedMath
  [
    'speed_math_answer',
    {
      kind: 'modal',
      config: {
        modalId: 'modal_speed_math',
        title: 'Speed Math',
        label: 'Resultado',
        placeholder: 'Digite o número',
      },
    },
  ],
  // BattleRoyale
  [
    'battle_royale_respond',
    {
      kind: 'modal',
      config: {
        modalId: 'modal_battle_royale',
        title: 'Sua Resposta',
        label: 'Responda o desafio',
        placeholder: 'Digite sua resposta',
      },
    },
  ],
]);

type PrefixRule = { prefix: string; parse: (suffix: string) => ButtonResult };

const PREFIX_RULES: PrefixRule[] = [
  {
    prefix: 'dice_count_',
    parse(suffix) {
      const count = parseInt(suffix, 10);
      if (!Number.isInteger(count) || count < 2 || count > 5)
        return { kind: 'ignore' };
      return { kind: 'action', action: { type: 'change_dice_count', count } };
    },
  },
  {
    prefix: 'lottery_select_',
    parse(suffix) {
      const number = parseInt(suffix, 10);
      if (!Number.isInteger(number) || number < 1 || number > 60)
        return { kind: 'ignore' };
      return { kind: 'action', action: { type: 'select_number', number } };
    },
  },
  {
    prefix: 'ttt_move_',
    parse(suffix) {
      const [rowStr, colStr] = suffix.split('_');
      const row = parseInt(rowStr, 10);
      const col = parseInt(colStr, 10);
      if (!Number.isInteger(row) || !Number.isInteger(col))
        return { kind: 'ignore' };
      if (row < 0 || row > 2 || col < 0 || col > 2) return { kind: 'ignore' };
      return { kind: 'action', action: { type: 'move', row, col } };
    },
  },
  {
    prefix: 'quiz_answer_',
    parse(suffix) {
      const answer = parseInt(suffix, 10);
      if (!Number.isInteger(answer) || answer < 0 || answer > 3)
        return { kind: 'ignore' };
      return { kind: 'action', action: { type: 'answer', answer } };
    },
  },
  {
    prefix: 'geo_answer_',
    parse(suffix) {
      const answer = parseInt(suffix, 10);
      if (!Number.isInteger(answer) || answer < 0 || answer > 3)
        return { kind: 'ignore' };
      return { kind: 'action', action: { type: 'answer', answer } };
    },
  },
  {
    prefix: 'pop_answer_',
    parse(suffix) {
      const answer = parseInt(suffix, 10);
      if (!Number.isInteger(answer) || answer < 0 || answer > 3)
        return { kind: 'ignore' };
      return { kind: 'action', action: { type: 'answer', answer } };
    },
  },
  {
    prefix: 'history_answer_',
    parse(suffix) {
      const answer = parseInt(suffix, 10);
      if (!Number.isInteger(answer) || answer < 0 || answer > 3)
        return { kind: 'ignore' };
      return { kind: 'action', action: { type: 'answer', answer } };
    },
  },
  {
    prefix: 'word_letter_',
    parse(suffix) {
      if (suffix.length !== 1 || !/^[A-Za-z]$/.test(suffix))
        return { kind: 'ignore' };
      return {
        kind: 'action',
        action: { type: 'guess_letter', letter: suffix.toUpperCase() },
      };
    },
  },
  {
    prefix: 'maze_noop_',
    parse() {
      return { kind: 'ignore' };
    },
  },
];

function legacyParseButton(customId: string): ButtonResult {
  const staticResult = STATIC_BUTTONS.get(customId);
  if (staticResult) return staticResult;

  for (const rule of PREFIX_RULES) {
    if (customId.startsWith(rule.prefix)) {
      return rule.parse(customId.slice(rule.prefix.length));
    }
  }

  return { kind: 'ignore' };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveDescriptors(
  descriptors: ButtonDescriptor[],
  customId: string,
): ButtonResult {
  for (const d of descriptors) {
    if (d.kind === 'static' && d.customId === customId) return d.result;
    if (d.kind === 'prefix' && customId.startsWith(d.prefix)) {
      return d.parse(customId.slice(d.prefix.length));
    }
  }
  return { kind: 'ignore' };
}

async function buildAndShowModal(
  btn: ButtonInteraction,
  config: ModalConfig,
): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId(config.modalId)
    .setTitle(config.title);
  const input = new TextInputBuilder()
    .setCustomId('input')
    .setLabel(config.label)
    .setPlaceholder(config.placeholder)
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(config.maxLength ?? 100);
  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(input),
  );
  await btn.showModal(modal);
}

// ---------------------------------------------------------------------------
// Public handler
// ---------------------------------------------------------------------------

export async function handleButtonInteraction(
  btn: ButtonInteraction,
): Promise<void> {
  const session = gameManager.getSessionByChannel(btn.channelId);
  if (!session) return;
  const gameInstance = gameManager.getGameInstance(session.id);
  if (!gameInstance) return;

  // Try new API first (game owns its dispatch rules)
  const descriptors = gameInstance.getButtonDescriptors();
  let result: ButtonResult =
    descriptors.length > 0
      ? resolveDescriptors(descriptors, btn.customId)
      : { kind: 'ignore' };

  // Fall through to legacy tables for the 20 existing games
  if (result.kind === 'ignore') {
    result = legacyParseButton(btn.customId);
  }

  if (result.kind === 'ignore') return;

  if (result.kind === 'modal') {
    try {
      await buildAndShowModal(btn, result.config);
    } catch (error) {
      console.error('Error showing game modal:', error);
    }
    return;
  }

  await btn.deferUpdate();
  await handleGameInteraction(
    btn.user.id,
    btn.channelId,
    result.action,
    (payload) => btn.editReply(payload),
    (msg) =>
      btn
        .followUp({ content: msg, flags: MessageFlags.Ephemeral })
        .then(() => {}),
  );
}
