import { ButtonStyle, EmbedBuilder } from 'discord.js';
import {
  BaseGame,
  GameResult,
  GameSession,
  PlayerStatus,
} from '../core/GameTypes';
import { GameUtils } from '../core/GameUtils';

interface LotteryData {
  playerNumbers: number[];
  winningNumbers: number[];
  matches: number;
  prize: number;
  drawn: boolean;
  ticketCost: number;
  currentNumberPage: number;
}

export class LotteryGame extends BaseGame {
  private readonly minNumber = 1;
  private readonly maxNumber = 60;
  private readonly numbersToSelect = 6;
  private readonly ticketCost = 50;

  constructor(session: GameSession) {
    super(session);
    this.session.data = {
      playerNumbers: [],
      winningNumbers: [],
      matches: 0,
      prize: 0,
      drawn: false,
      ticketCost: this.ticketCost,
      currentNumberPage: 0,
    } as LotteryData;
  }

  async start(): Promise<void> {
    this.session.players[0].status = PlayerStatus.ACTIVE;
  }

  async handlePlayerAction(userId: string, action: any): Promise<void> {
    const data = this.session.data as LotteryData;

    if (data.drawn) return;

    switch (action.type) {
      case 'select_number':
        this.selectNumber(action.number);
        break;
      case 'remove_number':
        this.removeNumber(action.number);
        break;
      case 'quick_pick':
        this.quickPick();
        break;
      case 'draw':
        await this.drawNumbers();
        break;
      case 'clear_numbers':
        this.clearNumbers();
        break;
      case 'page_prev':
        if (data.currentNumberPage > 0) data.currentNumberPage--;
        break;
      case 'page_next':
        if (data.currentNumberPage < 2) data.currentNumberPage++;
        break;
    }
  }

  private selectNumber(number: number): void {
    const data = this.session.data as LotteryData;

    if (number < this.minNumber || number > this.maxNumber) return;
    if (data.playerNumbers.includes(number)) return;
    if (data.playerNumbers.length >= this.numbersToSelect) return;

    data.playerNumbers.push(number);
    data.playerNumbers.sort((a, b) => a - b);
  }

  private removeNumber(number: number): void {
    const data = this.session.data as LotteryData;
    const index = data.playerNumbers.indexOf(number);

    if (index > -1) {
      data.playerNumbers.splice(index, 1);
    }
  }

  private quickPick(): void {
    const data = this.session.data as LotteryData;

    data.playerNumbers = [];
    while (data.playerNumbers.length < this.numbersToSelect) {
      const number =
        Math.floor(Math.random() * this.maxNumber) + this.minNumber;
      if (!data.playerNumbers.includes(number)) {
        data.playerNumbers.push(number);
      }
    }
    data.playerNumbers.sort((a, b) => a - b);
  }

  private clearNumbers(): void {
    this.session.data.playerNumbers = [];
  }

  private async drawNumbers(): Promise<void> {
    const data = this.session.data as LotteryData;

    if (data.playerNumbers.length !== this.numbersToSelect) return;

    // Generate winning numbers
    data.winningNumbers = [];
    while (data.winningNumbers.length < this.numbersToSelect) {
      const number =
        Math.floor(Math.random() * this.maxNumber) + this.minNumber;
      if (!data.winningNumbers.includes(number)) {
        data.winningNumbers.push(number);
      }
    }
    data.winningNumbers.sort((a, b) => a - b);

    // Calculate matches
    data.matches = data.playerNumbers.filter((num) =>
      data.winningNumbers.includes(num),
    ).length;

    // Calculate prize
    data.prize = this.calculatePrize(data.matches);
    data.drawn = true;

    this.updatePlayerScore(this.session.players[0].userId, data.prize);
  }

  private calculatePrize(matches: number): number {
    const basePrize = this.ticketCost;

    switch (matches) {
      case 6: // Jackpot
        return basePrize * 100;
      case 5: // Second prize
        return basePrize * 20;
      case 4: // Third prize
        return basePrize * 5;
      case 3: // Fourth prize
        return basePrize * 2;
      case 2: // Consolation
        return Math.floor(basePrize * 0.5);
      default:
        return 0;
    }
  }

  private getPrizeDescription(matches: number): string {
    switch (matches) {
      case 6:
        return '🎊 JACKPOT! SEIS NÚMEROS!';
      case 5:
        return '🎉 CINCO NÚMEROS! Segundo prêmio!';
      case 4:
        return '🎈 QUATRO NÚMEROS! Terceiro prêmio!';
      case 3:
        return '😊 TRÊS NÚMEROS! Quarto prêmio!';
      case 2:
        return '😐 DOIS NÚMEROS! Prêmio de consolação!';
      case 1:
        return '😢 UM NÚMERO! Quase lá...';
      default:
        return '😭 NENHUM NÚMERO! Mais sorte na próxima!';
    }
  }

  getGameEmbed(): EmbedBuilder {
    const data = this.session.data as LotteryData;
    const player = this.session.players[0];

    let description = `👤 **Jogador:** ${player.username}\n`;
    description += `🎫 **Custo do bilhete:** ${data.ticketCost} coins\n\n`;

    // Player's numbers
    if (data.playerNumbers.length > 0) {
      description += `**Seus números (${data.playerNumbers.length}/${this.numbersToSelect}):**\n`;
      description += `🔢 ${data.playerNumbers.map((n) => `**${n}**`).join(' - ')}\n\n`;
    } else {
      description += `🎯 **Escolha ${this.numbersToSelect} números de ${this.minNumber} a ${this.maxNumber}**\n\n`;
    }

    // Results
    if (data.drawn) {
      description += `**Números sorteados:**\n`;
      description += `🎱 ${data.winningNumbers.map((n) => `**${n}**`).join(' - ')}\n\n`;

      // Matched numbers
      const matchedNumbers = data.playerNumbers.filter((num) =>
        data.winningNumbers.includes(num),
      );

      if (matchedNumbers.length > 0) {
        description += `**Números que você acertou:**\n`;
        description += `✅ ${matchedNumbers.map((n) => `**${n}**`).join(' - ')}\n\n`;
      }

      description += `${this.getPrizeDescription(data.matches)}\n`;

      if (data.prize > 0) {
        description += `💰 **Prêmio:** ${data.prize} coins\n`;
        const profit = data.prize - data.ticketCost;
        if (profit > 0) {
          description += `📈 **Lucro:** +${profit} coins`;
        } else if (profit < 0) {
          description += `📉 **Prejuízo:** ${profit} coins`;
        } else {
          description += `💸 **Empate:** 0 coins`;
        }
      } else {
        description += `💸 **Prejuízo:** -${data.ticketCost} coins`;
      }
    } else {
      const pageStart = data.currentNumberPage * 20 + 1;
      const pageEnd = Math.min(pageStart + 19, this.maxNumber);
      description += `📄 **Página ${data.currentNumberPage + 1}/3** (números ${pageStart}–${pageEnd})\n\n`;
      description += `**Prêmios disponíveis:**\n`;
      description += `🎊 6 números: ${this.calculatePrize(6)} coins\n`;
      description += `🎉 5 números: ${this.calculatePrize(5)} coins\n`;
      description += `🎈 4 números: ${this.calculatePrize(4)} coins\n`;
      description += `😊 3 números: ${this.calculatePrize(3)} coins\n`;
      description += `😐 2 números: ${this.calculatePrize(2)} coins`;
    }

    const color = data.drawn
      ? data.matches >= 4
        ? 0x00ff00
        : data.matches >= 2
          ? 0xffaa00
          : 0xff6b6b
      : 0x3498db;

    return GameUtils.createGameEmbed(
      '🎫 Loteria do Marquinhos',
      description,
      color,
    );
  }

  getNumberButtons() {
    const data = this.session.data as LotteryData;

    if (data.drawn) return [];

    const buttons = [];
    const buttonsPerRow = 5;
    const numbersPerPage = 20; // 4 rows × 5 buttons
    const pageStart = data.currentNumberPage * numbersPerPage + 1;
    const pageEnd = Math.min(pageStart + numbersPerPage - 1, this.maxNumber);

    for (let start = pageStart; start <= pageEnd; start += buttonsPerRow) {
      const labels: string[] = [];
      const customIds: string[] = [];
      const styles: ButtonStyle[] = [];
      const disabled: boolean[] = [];

      for (let i = 0; i < buttonsPerRow && start + i <= pageEnd; i++) {
        const number = start + i;
        const isSelected = data.playerNumbers.includes(number);
        labels.push(number.toString());
        customIds.push(`lottery_select_${number}`);
        styles.push(isSelected ? ButtonStyle.Success : ButtonStyle.Secondary);
        disabled.push(
          !isSelected && data.playerNumbers.length >= this.numbersToSelect,
        );
      }

      if (labels.length > 0) {
        buttons.push(
          GameUtils.createGameButtons({ labels, customIds, styles, disabled }),
        );
      }
    }

    return buttons;
  }

  getActionButtons() {
    const data = this.session.data as LotteryData;

    if (data.drawn) {
      return [];
    }

    const canDraw = data.playerNumbers.length === this.numbersToSelect;
    const totalPages = 3; // pages 0-2 cover numbers 1-60

    return [
      GameUtils.createGameButtons({
        labels: ['◀️', '🎲 Surpresinha', '🗑️ Limpar', '🎪 Sortear', '▶️'],
        customIds: [
          'lottery_page_prev',
          'lottery_quick_pick',
          'lottery_clear',
          'lottery_draw',
          'lottery_page_next',
        ],
        styles: [
          ButtonStyle.Primary,
          ButtonStyle.Secondary,
          ButtonStyle.Danger,
          ButtonStyle.Primary,
          ButtonStyle.Primary,
        ],
        disabled: [
          data.currentNumberPage === 0,
          false,
          data.playerNumbers.length === 0,
          !canDraw,
          data.currentNumberPage >= totalPages - 1,
        ],
      }),
    ];
  }

  async finish(): Promise<GameResult> {
    const player = this.session.players[0];
    const data = this.session.data as LotteryData;
    const rewards = this.calculateRewards(player, 1);

    // Bonus XP based on matches
    rewards.xp += data.matches * 5;

    // Big bonus for jackpot
    if (data.matches === 6) {
      rewards.xp += 50;
    }

    return {
      sessionId: this.session.id,
      winners: data.prize > data.ticketCost ? [player.userId] : [],
      losers: data.prize <= data.ticketCost ? [player.userId] : [],
      rewards: { [player.userId]: rewards },
      stats: {
        matches: data.matches,
        prize: data.prize,
        playerNumbers: data.playerNumbers,
        winningNumbers: data.winningNumbers,
        profit: data.prize - data.ticketCost,
      },
      duration: Date.now() - this.session.startedAt.getTime(),
    };
  }

  protected getBaseXpForGame(): number {
    return 5;
  }
}
