import { EmbedBuilder, ButtonStyle } from 'discord.js';
import { BaseGame, GameSession, GameResult, PlayerStatus } from '../core/GameTypes';
import { GameUtils } from '../core/GameUtils';

interface SlotsData {
  reels: string[][];
  result: string[];
  multiplier: number;
  winType: string;
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
    'ANY_TWO': 2
  };

  constructor(session: GameSession) {
    super(session);
    this.session.data = {
      spins: 0,
      totalWinnings: 0,
      currentBet: 10,
      reels: [[], [], []],
      result: [],
      multiplier: 0,
      winType: 'none'
    } as SlotsData;
  }

  async start(): Promise<void> {
    this.session.players[0].status = PlayerStatus.ACTIVE;
    await this.spin();
  }

  async handlePlayerAction(userId: string, action: any): Promise<void> {
    if (action.type === 'spin') {
      await this.spin();
    } else if (action.type === 'change_bet') {
      this.changeBet(action.amount);
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
      GameUtils.getRandomElement(this.symbols)
    ];

    const { multiplier, winType } = this.calculatePayout(result);
    const winnings = this.session.data.currentBet * multiplier;

    this.session.data = {
      reels,
      result,
      multiplier,
      winType,
      spins: this.session.data.spins + 1,
      totalWinnings: this.session.data.totalWinnings + winnings,
      currentBet: this.session.data.currentBet
    };

    this.updatePlayerScore(this.session.players[0].userId, this.session.data.totalWinnings);
  }

  private calculatePayout(result: string[]): { multiplier: number, winType: string } {
    const resultString = result.join('');
    
    // Check for exact matches
    for (const [combination, payout] of Object.entries(this.payouts)) {
      if (combination === resultString) {
        return { multiplier: payout, winType: combination };
      }
    }

    // Check for two matching symbols
    if (result[0] === result[1] || result[1] === result[2] || result[0] === result[2]) {
      return { multiplier: this.payouts.ANY_TWO, winType: 'Dois iguais' };
    }

    return { multiplier: 0, winType: 'Sem prêmio' };
  }

  private changeBet(amount: number): void {
    if (amount >= 5 && amount <= 100) {
      this.session.data.currentBet = amount;
    }
  }

  getGameEmbed(): EmbedBuilder {
    const data = this.session.data;
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
      data.multiplier > 0 ? 0x00ff00 : 0xffaa00
    );

    return embed;
  }

  getActionButtons() {
    return [
      GameUtils.createGameButtons({
        labels: ['🎰 Girar', '⬇️ Diminuir Aposta', '⬆️ Aumentar Aposta'],
        customIds: ['slots_spin', 'slots_bet_down', 'slots_bet_up'],
        styles: [ButtonStyle.Primary, ButtonStyle.Secondary, ButtonStyle.Secondary]
      })
    ];
  }

  async finish(): Promise<GameResult> {
    const player = this.session.players[0];
    const rewards = this.calculateRewards(player, 1);
    
    // Bonus XP for big wins
    if (this.session.data.totalWinnings > 100) {
      rewards.xp += Math.floor(this.session.data.totalWinnings / 10);
    }

    return {
      sessionId: this.session.id,
      winners: [player.userId],
      losers: [],
      rewards: { [player.userId]: rewards },
      stats: {
        spins: this.session.data.spins,
        totalWinnings: this.session.data.totalWinnings,
        biggestWin: this.session.data.multiplier
      },
      duration: Date.now() - this.session.startedAt.getTime()
    };
  }

  protected getBaseXpForGame(): number {
    return 5;
  }
}
