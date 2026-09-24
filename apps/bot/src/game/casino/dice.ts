import { checkBet, type DiceBet } from '@marquinhos/domain/games/casino/dice';
import { ButtonStyle, EmbedBuilder } from 'discord.js';
import { z } from 'zod';
import {
  BaseGame,
  BET_RANGE,
  GameResult,
  GameSession,
  PlayerStatus,
} from '../core/GameTypes';
import { GameUtils } from '../core/GameUtils';

type DiceData = {
  diceCount: number;
  lastRoll: number[];
  totalRolls: number;
  bet: number;
  winnings: number;
  history: DiceRoll[];
  finished?: boolean;
} & DiceBet;

interface DiceRoll {
  dice: number[];
  sum: number;
  bet: string;
  result: 'win' | 'lose';
  payout: number;
}

const DiceActionSchema = z.union([
  z.object({ type: z.literal('roll') }),
  z.object({
    type: z.literal('set_bet'),
    betType: z.literal('sum'),
    betValue: z.number(),
  }),
  z.object({
    type: z.literal('set_bet'),
    betType: z.literal('exact'),
    betValue: z.number(),
  }),
  z.object({
    type: z.literal('set_bet'),
    betType: z.literal('even_odd'),
    betValue: z.enum(['even', 'odd']),
  }),
  z.object({
    type: z.literal('set_bet'),
    betType: z.literal('high_low'),
    betValue: z.enum(['high', 'low']),
  }),
  z.object({ type: z.literal('change_dice_count'), count: z.number() }),
  z.object({ type: z.literal('change_bet_amount'), amount: z.number() }),
  z.object({ type: z.literal('cancel_bet') }),
  z.object({ type: z.literal('finish_session') }),
]);

type DiceAction = z.infer<typeof DiceActionSchema>;

export class DiceGame extends BaseGame<DiceData, DiceAction> {
  private readonly diceEmojis = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

  constructor(session: GameSession) {
    super(session);
    this.data = {
      diceCount: 2,
      lastRoll: [],
      totalRolls: 0,
      bet: 10,
      betType: null,
      betValue: null,
      winnings: 0,
      history: [],
    };
  }

  async start(): Promise<void> {
    this.session.players[0].status = PlayerStatus.ACTIVE;
  }

  async handlePlayerAction(userId: string, action: DiceAction): Promise<void> {
    const parsed = DiceActionSchema.parse(action);

    if (this.data.finished) return;

    switch (parsed.type) {
      case 'roll':
        await this.rollDice();
        break;
      case 'set_bet':
        this.setBet(parsed);
        break;
      case 'change_dice_count':
        this.changeDiceCount(parsed.count);
        break;
      case 'change_bet_amount':
        this.changeBetAmount(parsed.amount);
        break;
      case 'cancel_bet':
        break;
      case 'finish_session':
        this.data.finished = true;
        break;
    }
  }

  private async rollDice(): Promise<void> {
    const data = this.data;

    if (!data.betType) return;

    const roll: number[] = [];
    for (let i = 0; i < data.diceCount; i++) {
      roll.push(Math.floor(Math.random() * 6) + 1);
    }

    const sum = roll.reduce((a, b) => a + b, 0);
    const { isWin, payout } = checkBet(data, roll);

    const rollResult: DiceRoll = {
      dice: [...roll],
      sum,
      bet: this.formatBetDescription(),
      result: isWin ? 'win' : 'lose',
      payout: isWin ? data.bet * payout : 0,
    };

    data.lastRoll = roll;
    data.totalRolls++;
    data.winnings += rollResult.payout;
    data.history.push(rollResult);

    // Keep only last 5 rolls in history
    if (data.history.length > 5) {
      data.history.shift();
    }

    // Reset bet after roll
    this.setBet({ betType: null, betValue: null });

    this.updatePlayerScore(this.session.players[0].userId, data.winnings);
  }

  private setBet(bet: DiceBet): void {
    this.data = { ...this.data, ...bet };
  }

  private changeDiceCount(count: number): void {
    if (count >= 2 && count <= 5) {
      this.data.diceCount = count;
    }
  }

  private changeBetAmount(amount: number): void {
    if (amount >= BET_RANGE.min && amount <= BET_RANGE.max) {
      this.data.bet = amount;
    }
  }

  private formatBetDescription(): string {
    const data = this.data;

    switch (data.betType) {
      case 'sum':
        return `Soma = ${data.betValue}`;
      case 'exact':
        return `Número ${data.betValue} aparece`;
      case 'even_odd':
        return `Soma ${data.betValue === 'even' ? 'par' : 'ímpar'}`;
      case 'high_low':
        return `Soma ${data.betValue === 'high' ? 'alta' : 'baixa'}`;
      default:
        return 'Sem aposta';
    }
  }

  getGameEmbed(): EmbedBuilder {
    const data = this.data;
    const player = this.session.players[0];

    if (data.finished) {
      const description =
        `🏁 **Jogo encerrado!**\n\n` +
        `👤 **Jogador:** ${player.username}\n` +
        `🎲 **Total de jogadas:** ${data.totalRolls}\n` +
        `💎 **Total ganho:** ${data.winnings} coins`;
      return GameUtils.createGameEmbed(
        '🎲 Dados Mágicos',
        description,
        0x808080,
      );
    }

    let description = `👤 **Jogador:** ${player.username}\n`;
    description += `🎲 **Dados:** ${data.diceCount}\n`;
    description += `💰 **Aposta:** ${data.bet} coins\n`;
    description += `💎 **Total ganho:** ${data.winnings} coins\n\n`;

    // Last roll
    if (data.lastRoll.length > 0) {
      const diceDisplay = data.lastRoll
        .map((d) => this.diceEmojis[d - 1])
        .join(' ');
      const sum = data.lastRoll.reduce((a, b) => a + b, 0);
      description += `**Último resultado:** ${diceDisplay}\n`;
      description += `**Soma:** ${sum}\n\n`;
    }

    // Current bet
    if (data.betType) {
      description += `🎯 **FASE: PRONTO PARA ROLAR**\n`;
      description += `Aposta: ${this.formatBetDescription()}\n`;
      description += `💰 **Valor apostado:** ${data.bet} coins\n\n`;
    } else {
      description += `📝 **FASE: FAÇA SUA APOSTA**\n`;
      description += `❓ Escolha um tipo de aposta abaixo para liberar o botão de rolar!\n\n`;
    }

    // Recent history
    if (data.history.length > 0) {
      description += `**Histórico recente:**\n`;
      data.history.slice(-3).forEach((roll, _index) => {
        const emoji = roll.result === 'win' ? '✅' : '❌';
        const diceDisplay = roll.dice
          .map((d) => this.diceEmojis[d - 1])
          .join('');
        description += `${emoji} ${diceDisplay} (${roll.sum}) - ${roll.bet} - ${roll.payout > 0 ? `+${roll.payout}` : '0'}\n`;
      });
    }

    const color =
      data.history.length > 0 &&
      data.history[data.history.length - 1]?.result === 'win'
        ? 0x00ff00
        : 0xffaa00;

    return GameUtils.createGameEmbed(
      '🎲 Dados Mágicos',
      description,
      color,
      this.session.expiresAt,
    );
  }

  getBetButtons() {
    const data = this.data;
    const maxSum = data.diceCount * 6;
    const _minSum = data.diceCount;
    const _midPoint = maxSum / 2;

    return [
      // Bet type selection
      GameUtils.createGameButtons({
        labels: [
          '📊 Soma Específica',
          '🔢 Número Exato',
          '⚪ Par/Ímpar',
          '📈 Alto/Baixo',
        ],
        customIds: [
          'dice_bet_sum',
          'dice_bet_exact',
          'dice_bet_even_odd',
          'dice_bet_high_low',
        ],
      }),

      // Dice count
      GameUtils.createGameButtons({
        labels: ['2🎲', '3🎲', '4🎲', '5🎲'],
        customIds: [
          'dice_count_2',
          'dice_count_3',
          'dice_count_4',
          'dice_count_5',
        ],
        styles: [
          ButtonStyle.Secondary,
          ButtonStyle.Secondary,
          ButtonStyle.Secondary,
          ButtonStyle.Secondary,
        ],
      }),
    ];
  }

  getActionButtons() {
    const data = this.data;
    if (data.finished) return [];

    const endGameButton = GameUtils.createGameButtons({
      labels: ['🏁 Encerrar Jogo'],
      customIds: ['dice_finish'],
      styles: [ButtonStyle.Secondary],
    });

    if (data.betType) {
      return [
        GameUtils.createGameButtons({
          labels: ['🎲 Rolar Dados', '❌ Cancelar Aposta'],
          customIds: ['dice_roll', 'dice_cancel_bet'],
          styles: [ButtonStyle.Primary, ButtonStyle.Danger],
        }),
        endGameButton,
      ];
    }

    return [...this.getBetButtons(), endGameButton];
  }

  async finish(): Promise<GameResult> {
    const player = this.session.players[0];
    const data = this.data;
    const rewards = this.calculateRewards(player, 1);

    // Bonus XP for good performance
    const winRate =
      data.history.filter((h) => h.result === 'win').length /
      Math.max(data.history.length, 1);
    if (winRate > 0.5) {
      rewards.xp += Math.floor(winRate * 20);
    }

    return {
      sessionId: this.session.id,
      winners: data.winnings > 0 ? [player.userId] : [],
      losers: [],
      rewards: { [player.userId]: rewards },
      stats: {
        totalRolls: data.totalRolls,
        winnings: data.winnings,
        winRate:
          data.history.filter((h) => h.result === 'win').length /
          Math.max(data.history.length, 1),
        biggestWin: Math.max(...data.history.map((h) => h.payout)),
      },
      duration: Date.now() - this.session.startedAt.getTime(),
    };
  }

  protected getBaseXpForGame(): number {
    return 5;
  }
}
