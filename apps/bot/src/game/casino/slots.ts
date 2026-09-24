import { calculatePayout } from '@marquinhos/domain/games/casino/slots';
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

interface SlotsData {
  spins: number;
  totalWinnings: number;
  currentBet: number;
  reels?: string[][];
  result?: string[];
  multiplier?: number;
  winType?: string;
  finished?: boolean;
}

const SlotsActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('spin') }),
  z.object({ type: z.literal('stop') }),
  z.object({ type: z.literal('bet_down') }),
  z.object({ type: z.literal('bet_up') }),
  z.object({ type: z.literal('change_bet'), amount: z.number() }),
]);

type SlotsAction = z.infer<typeof SlotsActionSchema>;

export class SlotsGame extends BaseGame<SlotsData, SlotsAction> {
  private readonly symbols = ['🍒', '🍋', '🍊', '🍇', '🔔', '💎', '7️⃣', '⭐'];
  constructor(session: GameSession) {
    super(session);
    this.data = {
      spins: 0,
      totalWinnings: 0,
      currentBet: 10,
    };
  }

  async start(): Promise<void> {
    this.session.players[0].status = PlayerStatus.ACTIVE;
    await this.spin();
  }

  async handlePlayerAction(userId: string, action: SlotsAction): Promise<void> {
    const parsed = SlotsActionSchema.parse(action);

    if (this.data.finished) return;

    switch (parsed.type) {
      case 'spin':
        await this.spin();
        break;
      case 'stop':
        this.data.finished = true;
        break;
      case 'bet_down':
        this.changeBet(Math.max(BET_RANGE.min, this.data.currentBet - 5));
        break;
      case 'bet_up':
        this.changeBet(Math.min(BET_RANGE.max, this.data.currentBet + 5));
        break;
      case 'change_bet':
        this.changeBet(parsed.amount);
        break;
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

    const { multiplier, winType } = calculatePayout(result);
    const prev = this.data;
    const winnings = prev.currentBet * multiplier;
    const newTotalWinnings = prev.totalWinnings + winnings;

    // Update score BEFORE replacing state to maintain consistency (P1 fix)
    this.updatePlayerScore(this.session.players[0].userId, newTotalWinnings);

    this.data = {
      reels,
      result,
      multiplier,
      winType,
      spins: prev.spins + 1,
      totalWinnings: newTotalWinnings,
      currentBet: prev.currentBet,
    };
  }

  private changeBet(amount: number): void {
    if (amount >= BET_RANGE.min && amount <= BET_RANGE.max) {
      this.data.currentBet = amount;
    }
  }

  getGameEmbed(): EmbedBuilder {
    const data = this.data;
    const player = this.session.players[0];

    let resultDisplay = '';
    if (data.result) {
      resultDisplay = `**${data.result.join(' | ')}**\n\n`;

      if ((data.multiplier ?? 0) > 0) {
        resultDisplay += `🎉 **${data.winType}!**\n`;
        resultDisplay += `💰 Ganhou: **${data.currentBet * (data.multiplier ?? 0)}** coins\n\n`;
      } else {
        resultDisplay += `😢 **${data.winType}**\n\n`;
      }
    }

    const description = data.finished
      ? `🏁 **Jogo encerrado!**\n\n` +
        `👤 **Jogador:** ${player.username}\n` +
        `🎲 **Jogadas:** ${data.spins}\n` +
        `💰 **Total ganho:** ${data.totalWinnings} coins`
      : `${resultDisplay}` +
        `👤 **Jogador:** ${player.username}\n` +
        `🎲 **Jogadas:** ${data.spins}\n` +
        `💰 **Total ganho:** ${data.totalWinnings} coins\n` +
        `🎯 **Aposta atual:** ${data.currentBet} coins\n\n` +
        `**Pagamentos:**\n` +
        `💎💎💎 - 100x | 7️⃣7️⃣7️⃣ - 50x | ⭐⭐⭐ - 25x\n` +
        `🔔🔔🔔 - 15x | 🍇🍇🍇 - 10x | Dois iguais - 2x`;

    return GameUtils.createGameEmbed(
      '🎰 Caça-níqueis do Marquinhos',
      description,
      data.finished
        ? 0x808080
        : (data.multiplier ?? 0) > 0
          ? 0x00ff00
          : 0xffaa00,
      data.finished ? undefined : this.session.expiresAt,
    );
  }

  getActionButtons() {
    const data = this.data;
    if (data.finished) return [];

    return [
      GameUtils.createGameButtons({
        labels: [
          '🎰 Girar',
          '🛑 Parar',
          '⬇️ Diminuir Aposta',
          '⬆️ Aumentar Aposta',
        ],
        customIds: [
          'slots_spin',
          'slots_stop',
          'slots_bet_down',
          'slots_bet_up',
        ],
        styles: [
          ButtonStyle.Primary,
          ButtonStyle.Secondary,
          ButtonStyle.Secondary,
          ButtonStyle.Secondary,
        ],
      }),
    ];
  }

  async finish(): Promise<GameResult> {
    const player = this.session.players[0];
    const rewards = this.calculateRewards(player, 1);
    const data = this.data;

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
    return 4;
  }
}
