import { ButtonStyle, EmbedBuilder } from 'discord.js';
import {
  BaseGame,
  GameResult,
  GameSession,
  PlayerStatus,
} from '../core/GameTypes';
import { GameUtils } from '../core/GameUtils';

interface SlotsData {
  spins: number;
  totalWinnings: number;
  currentBet: number;
  reels?: string[][];
  result?: string[];
  multiplier?: number;
  winType?: string;
}

export class SlotsGame extends BaseGame {
  private readonly symbols = ['🍒', '🍋', '🍊', '🍇', '🔔', '💎', '7️⃣', '⭐'];
  private readonly payouts = {
    '💎💎💎': 100,
    '7️⃣7️⃣7️⃣': 50,
    '⭐⭐⭐': 25,
    '🔔🔔🔔': 15,
    '🍇🍇🍇': 10,
    '🍊🍊🍊': 8,
    '🍋🍋🍋': 6,
    '🍒🍒🍒': 4,
    ANY_TWO: 2,
  };

  constructor(session: GameSession) {
    super(session);
    this.session.data = {
      spins: 0,
      totalWinnings: 0,
      currentBet: 10,
    } as SlotsData;
  }

  async start(): Promise<void> {
    this.session.players[0].status = PlayerStatus.ACTIVE;
    await this.spin();
  }

  async handlePlayerAction(
    userId: string,
    action: Record<string, unknown>,
  ): Promise<void> {
    if (action.type === 'spin') {
      await this.spin();
    } else if (action.type === 'bet_down') {
      this.changeBet(
        Math.max(5, (this.session.data as SlotsData).currentBet - 5),
      );
    } else if (action.type === 'bet_up') {
      this.changeBet(
        Math.min(100, (this.session.data as SlotsData).currentBet + 5),
      );
    } else if (action.type === 'change_bet') {
      this.changeBet(action.amount as number);
    }
  }

  private async spin(): Promise<void> {
    const reels: string[][] = [[], [], []];

    // Generate spinning animation
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 5; j++) {
        reels[i].push(GameUtils.getRandomElement(this.symbols));
      }
    }

    // Final result
    const result = [
      GameUtils.getRandomElement(this.symbols),
      GameUtils.getRandomElement(this.symbols),
      GameUtils.getRandomElement(this.symbols),
    ];

    const { multiplier, winType } = this.calculatePayout(result);
    const prev = this.session.data as SlotsData;
    const winnings = prev.currentBet * multiplier;
    const newTotalWinnings = prev.totalWinnings + winnings;

    // Update score BEFORE replacing state to maintain consistency (P1 fix)
    this.updatePlayerScore(this.session.players[0].userId, newTotalWinnings);

    this.session.data = {
      reels,
      result,
      multiplier,
      winType,
      spins: prev.spins + 1,
      totalWinnings: newTotalWinnings,
      currentBet: prev.currentBet,
    } as SlotsData;
  }

  private calculatePayout(result: string[]): {
    multiplier: number;
    winType: string;
  } {
    const resultString = result.join('');

    // Check for exact matches
    for (const [combination, payout] of Object.entries(this.payouts)) {
      if (combination === resultString) {
        return { multiplier: payout, winType: combination };
      }
    }

    // Check for two matching symbols
    if (
      result[0] === result[1] ||
      result[1] === result[2] ||
      result[0] === result[2]
    ) {
      return { multiplier: this.payouts.ANY_TWO, winType: 'Dois iguais' };
    }

    return { multiplier: 0, winType: 'Sem prêmio' };
  }

  private changeBet(amount: number): void {
    if (amount >= 5 && amount <= 100) {
      (this.session.data as SlotsData).currentBet = amount;
    }
  }

  getGameEmbed(): EmbedBuilder {
    const data = this.session.data as SlotsData;
    const player = this.session.players[0];

    let resultDisplay = '';
    if (data.result) {
      resultDisplay = `**${data.result.join(' | ')}**\n\n`;

      if (data.multiplier > 0) {
        resultDisplay += `🎉 **${data.winType}!**\n`;
        resultDisplay += `💰 Ganhou: **${data.currentBet * data.multiplier}** coins\n\n`;
      } else {
        resultDisplay += `😢 **${data.winType}**\n\n`;
      }
    }

    const embed = GameUtils.createGameEmbed(
      '🎰 Caça-níqueis do Marquinhos',
      `${resultDisplay}` +
        `👤 **Jogador:** ${player.username}\n` +
        `🎲 **Jogadas:** ${data.spins}\n` +
        `💰 **Total ganho:** ${data.totalWinnings} coins\n` +
        `🎯 **Aposta atual:** ${data.currentBet} coins\n\n` +
        `**Pagamentos:**\n` +
        `💎💎💎 - 100x | 7️⃣7️⃣7️⃣ - 50x | ⭐⭐⭐ - 25x\n` +
        `🔔🔔🔔 - 15x | 🍇🍇🍇 - 10x | Dois iguais - 2x`,
      data.multiplier > 0 ? 0x00ff00 : 0xffaa00,
    );

    return embed;
  }

  getActionButtons() {
    return [
      GameUtils.createGameButtons({
        labels: ['🎰 Girar', '⬇️ Diminuir Aposta', '⬆️ Aumentar Aposta'],
        customIds: ['slots_spin', 'slots_bet_down', 'slots_bet_up'],
        styles: [
          ButtonStyle.Primary,
          ButtonStyle.Secondary,
          ButtonStyle.Secondary,
        ],
      }),
    ];
  }

  async finish(): Promise<GameResult> {
    const player = this.session.players[0];
    const rewards = this.calculateRewards(player, 1);
    const data = this.session.data as SlotsData;

    // Bonus XP for big wins
    if (data.totalWinnings > 100) {
      rewards.xp += Math.floor(data.totalWinnings / 10);
    }

    return {
      sessionId: this.session.id,
      winners: [player.userId],
      losers: [],
      rewards: { [player.userId]: rewards },
      stats: {
        spins: data.spins,
        totalWinnings: data.totalWinnings,
        biggestWin: data.multiplier,
      },
      duration: Date.now() - this.session.startedAt.getTime(),
    };
  }

  protected getBaseXpForGame(): number {
    return 5;
  }
}
