import { EmbedBuilder, ButtonStyle } from 'discord.js';
import {
  BaseGame,
  GameSession,
  GameResult,
  PlayerStatus,
} from '../core/GameTypes';
import { GameUtils } from '../core/GameUtils';

interface DiceData {
  diceCount: number;
  lastRoll: number[];
  totalRolls: number;
  bet: number;
  betType: 'sum' | 'exact' | 'even_odd' | 'high_low' | null;
  betValue: number | string | null;
  winnings: number;
  history: DiceRoll[];
}

interface DiceRoll {
  dice: number[];
  sum: number;
  bet: string;
  result: 'win' | 'lose';
  payout: number;
}

export class DiceGame extends BaseGame {
  private readonly diceEmojis = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

  constructor(session: GameSession) {
    super(session);
    this.session.data = {
      diceCount: 2,
      lastRoll: [],
      totalRolls: 0,
      bet: 10,
      betType: null,
      betValue: null,
      winnings: 0,
      history: [],
    } as DiceData;
  }

  async start(): Promise<void> {
    this.session.players[0].status = PlayerStatus.ACTIVE;
  }

  async handlePlayerAction(userId: string, action: any): Promise<void> {
    const data = this.session.data as DiceData;

    switch (action.type) {
      case 'roll':
        await this.rollDice();
        break;
      case 'set_bet':
        this.setBet(action.betType, action.betValue);
        break;
      case 'change_dice_count':
        this.changeDiceCount(action.count);
        break;
      case 'change_bet_amount':
        this.changeBetAmount(action.amount);
        break;
    }
  }

  private async rollDice(): Promise<void> {
    const data = this.session.data as DiceData;

    if (!data.betType) return;

    const roll: number[] = [];
    for (let i = 0; i < data.diceCount; i++) {
      roll.push(Math.floor(Math.random() * 6) + 1);
    }

    const sum = roll.reduce((a, b) => a + b, 0);
    const { isWin, payout } = this.checkBet(roll, sum);

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
    data.betType = null;
    data.betValue = null;

    this.updatePlayerScore(this.session.players[0].userId, data.winnings);
  }

  private checkBet(
    roll: number[],
    sum: number,
  ): { isWin: boolean; payout: number } {
    const data = this.session.data as DiceData;

    switch (data.betType) {
      case 'sum':
        return {
          isWin: sum === data.betValue,
          payout: this.getSumPayout(data.diceCount, data.betValue as number),
        };

      case 'exact':
        const exactValue = data.betValue as number;
        const hasExact = roll.includes(exactValue);
        const count = roll.filter((d) => d === exactValue).length;
        return {
          isWin: hasExact,
          payout: count * 2,
        };

      case 'even_odd':
        const isEven = sum % 2 === 0;
        const betEven = data.betValue === 'even';
        return {
          isWin: isEven === betEven,
          payout: 2,
        };

      case 'high_low':
        const maxSum = data.diceCount * 6;
        const midPoint = maxSum / 2;
        const isHigh = sum > midPoint;
        const betHigh = data.betValue === 'high';
        return {
          isWin: isHigh === betHigh,
          payout: 2,
        };

      default:
        return { isWin: false, payout: 0 };
    }
  }

  private getSumPayout(diceCount: number, targetSum: number): number {
    // Higher payouts for harder to achieve sums
    const minSum = diceCount;
    const maxSum = diceCount * 6;
    const midPoint = (minSum + maxSum) / 2;

    const distance = Math.abs(targetSum - midPoint);
    const maxDistance = midPoint - minSum;
    const difficulty = distance / maxDistance;

    return Math.floor(2 + difficulty * 8); // 2x to 10x payout
  }

  private setBet(betType: string, betValue: any): void {
    const data = this.session.data as DiceData;
    data.betType = betType as any;
    data.betValue = betValue;
  }

  private changeDiceCount(count: number): void {
    if (count >= 2 && count <= 5) {
      this.session.data.diceCount = count;
    }
  }

  private changeBetAmount(amount: number): void {
    if (amount >= 5 && amount <= 100) {
      this.session.data.bet = amount;
    }
  }

  private formatBetDescription(): string {
    const data = this.session.data as DiceData;

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
    const data = this.session.data as DiceData;
    const player = this.session.players[0];

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
      description += `🎯 **Aposta atual:** ${this.formatBetDescription()}\n`;
      description += `💰 **Valor apostado:** ${data.bet} coins\n\n`;
    } else {
      description += `❓ **Faça sua aposta para rolar os dados!**\n\n`;
    }

    // Recent history
    if (data.history.length > 0) {
      description += `**Histórico recente:**\n`;
      data.history.slice(-3).forEach((roll, index) => {
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

    return GameUtils.createGameEmbed('🎲 Dados Mágicos', description, color);
  }

  getBetButtons() {
    const data = this.session.data as DiceData;
    const maxSum = data.diceCount * 6;
    const minSum = data.diceCount;
    const midPoint = maxSum / 2;

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
    const data = this.session.data as DiceData;

    if (data.betType) {
      return [
        GameUtils.createGameButtons({
          labels: ['🎲 Rolar Dados', '❌ Cancelar Aposta'],
          customIds: ['dice_roll', 'dice_cancel_bet'],
          styles: [ButtonStyle.Primary, ButtonStyle.Danger],
        }),
      ];
    }

    return this.getBetButtons();
  }

  async finish(): Promise<GameResult> {
    const player = this.session.players[0];
    const data = this.session.data as DiceData;
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
    return 8;
  }
}
