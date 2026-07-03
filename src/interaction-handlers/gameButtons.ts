import { GameManager } from '@marquinhos/game/core/GameManager';
import { ButtonResult, ModalConfig } from '@marquinhos/game/core/GameTypes';
import { handleGameInteraction } from '@marquinhos/lib/gameInteraction';
import { logger } from '@marquinhos/utils/logger';
import {
  InteractionHandler,
  InteractionHandlerTypes,
} from '@sapphire/framework';
import {
  ActionRowBuilder,
  ButtonInteraction,
  InteractionEditReplyOptions,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';

const gameManager = GameManager.getInstance();

// ---------------------------------------------------------------------------
// Dispatch tables for the 7 games' buttons (casino: blackjack, slots,
// roulette, dice; strategy: maze, rock-paper-scissors, tic-tac-toe).
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
]);

type PrefixRule = { prefix: string; parse: (suffix: string) => ButtonResult };

const PREFIX_RULES: PrefixRule[] = [
  {
    prefix: 'dice_count_',
    parse(suffix: string) {
      const count = parseInt(suffix, 10);
      if (!Number.isInteger(count) || count < 2 || count > 5)
        return { kind: 'ignore' };
      return { kind: 'action', action: { type: 'change_dice_count', count } };
    },
  },
  {
    prefix: 'ttt_move_',
    parse(suffix: string) {
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

const GAME_BUTTON_PREFIXES = [
  'bj_',
  'slots_',
  'dice_',
  'roulette_',
  'rps_',
  'maze_',
  'ttt_',
] as const;

function isGameButtonCustomId(customId: string): boolean {
  return GAME_BUTTON_PREFIXES.some((prefix) => customId.startsWith(prefix));
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

export class GameButtonsHandler extends InteractionHandler {
  public constructor(ctx: InteractionHandler.LoaderContext) {
    super(ctx, { interactionHandlerType: InteractionHandlerTypes.Button });
  }

  override parse(interaction: ButtonInteraction) {
    if (!isGameButtonCustomId(interaction.customId)) return this.none();
    return this.some();
  }

  override async run(btn: ButtonInteraction) {
    const session = gameManager.getSessionByChannel(btn.channelId);
    if (!session) {
      await btn.reply({
        content: 'Esta partida já expirou.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const gameInstance = gameManager.getGameInstance(session.id);
    if (!gameInstance) {
      await btn.reply({
        content: 'Esta partida já expirou.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const result = legacyParseButton(btn.customId);
    if (result.kind === 'ignore') return;

    if (result.kind === 'modal') {
      try {
        await buildAndShowModal(btn, result.config);
      } catch (error) {
        logger.warn('Error showing game modal:', error);
      }
      return;
    }

    await btn.deferUpdate();
    await handleGameInteraction(
      btn.user.id,
      btn.channelId,
      result.action,
      (payload) => btn.editReply(payload as InteractionEditReplyOptions),
      (msg) =>
        btn
          .followUp({ content: msg, flags: MessageFlags.Ephemeral })
          .then(() => undefined),
    );
  }
}
