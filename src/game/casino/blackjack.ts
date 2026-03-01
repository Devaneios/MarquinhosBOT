import { ButtonStyle, EmbedBuilder } from 'discord.js';
import {
  BaseGame,
  GameResult,
  GameSession,
  PlayerStatus,
} from '../core/GameTypes';
import { GameUtils } from '../core/GameUtils';

interface Card {
  suit: string;
  value: string;
  numericValue: number;
}

interface BlackjackData {
  playerCards: Card[];
  dealerCards: Card[];
  deck: Card[];
  playerTotal: number;
  dealerTotal: number;
  gamePhase: 'initial' | 'player_turn' | 'dealer_turn' | 'finished';
  result: 'win' | 'lose' | 'push' | 'blackjack' | null;
  bet: number;
}

export class BlackjackGame extends BaseGame {
  private readonly suits = ['♠️', '♥️', '♦️', '♣️'];
  private readonly values = [
    { value: 'A', numeric: 11 },
    { value: '2', numeric: 2 },
    { value: '3', numeric: 3 },
    { value: '4', numeric: 4 },
    { value: '5', numeric: 5 },
    { value: '6', numeric: 6 },
    { value: '7', numeric: 7 },
    { value: '8', numeric: 8 },
    { value: '9', numeric: 9 },
    { value: '10', numeric: 10 },
    { value: 'J', numeric: 10 },
    { value: 'Q', numeric: 10 },
    { value: 'K', numeric: 10 },
  ];

  constructor(session: GameSession) {
    super(session);
    this.initializeGame();
  }

  private initializeGame(): void {
    const deck = this.createDeck();
    const playerCards = [this.drawCard(deck), this.drawCard(deck)];
    const dealerCards = [this.drawCard(deck), this.drawCard(deck)];

    this.session.data = {
      playerCards,
      dealerCards,
      deck,
      playerTotal: this.calculateTotal(playerCards),
      dealerTotal: this.calculateTotal([dealerCards[0]]), // Only show first card
      gamePhase: 'initial',
      result: null,
      bet: 20,
    } as BlackjackData;

    // Check for blackjack
    if (this.session.data.playerTotal === 21) {
      this.session.data.gamePhase = 'finished';
      this.session.data.result = 'blackjack';
    } else {
      this.session.data.gamePhase = 'player_turn';
    }
  }

  private createDeck(): Card[] {
    const deck: Card[] = [];

    for (const suit of this.suits) {
      for (const val of this.values) {
        deck.push({
          suit,
          value: val.value,
          numericValue: val.numeric,
        });
      }
    }

    return GameUtils.shuffleArray(deck);
  }

  private drawCard(deck: Card[]): Card {
    return deck.pop()!;
  }

  private calculateTotal(cards: Card[]): number {
    let total = 0;
    let aces = 0;

    for (const card of cards) {
      if (card.value === 'A') {
        aces++;
        total += 11;
      } else {
        total += card.numericValue;
      }
    }

    // Adjust for aces
    while (total > 21 && aces > 0) {
      total -= 10;
      aces--;
    }

    return total;
  }

  private formatCards(cards: Card[], hideSecond = false): string {
    return cards
      .map((card, index) => {
        if (hideSecond && index === 1) {
          return '🃏';
        }
        return `${card.value}${card.suit}`;
      })
      .join(' ');
  }

  async start(): Promise<void> {
    this.session.players[0].status = PlayerStatus.ACTIVE;
  }

  async handlePlayerAction(userId: string, action: any): Promise<void> {
    const data = this.session.data as BlackjackData;

    if (data.gamePhase !== 'player_turn') return;

    switch (action.type) {
      case 'hit':
        await this.hit();
        break;
      case 'stand':
        await this.stand();
        break;
      case 'double':
        await this.double();
        break;
    }
  }

  private async hit(): Promise<void> {
    const data = this.session.data as BlackjackData;
    const newCard = this.drawCard(data.deck);
    data.playerCards.push(newCard);
    data.playerTotal = this.calculateTotal(data.playerCards);

    if (data.playerTotal > 21) {
      data.gamePhase = 'finished';
      data.result = 'lose';
    } else if (data.playerTotal === 21) {
      await this.stand();
    }
  }

  private async stand(): Promise<void> {
    const data = this.session.data as BlackjackData;
    data.gamePhase = 'dealer_turn';

    // Reveal dealer's second card and calculate total
    data.dealerTotal = this.calculateTotal(data.dealerCards);

    // Dealer hits on 16 and below
    while (data.dealerTotal < 17) {
      const newCard = this.drawCard(data.deck);
      data.dealerCards.push(newCard);
      data.dealerTotal = this.calculateTotal(data.dealerCards);
    }

    data.gamePhase = 'finished';
    data.result = this.determineWinner();
  }

  private async double(): Promise<void> {
    const data = this.session.data as BlackjackData;
    data.bet *= 2;
    await this.hit();

    if (data.gamePhase === 'player_turn') {
      await this.stand();
    }
  }

  private determineWinner(): 'win' | 'lose' | 'push' {
    const data = this.session.data as BlackjackData;

    if (data.dealerTotal > 21) {
      return 'win'; // Dealer bust
    }

    if (data.playerTotal > data.dealerTotal) {
      return 'win';
    } else if (data.playerTotal < data.dealerTotal) {
      return 'lose';
    } else {
      return 'push'; // Tie
    }
  }

  getGameEmbed(): EmbedBuilder {
    const data = this.session.data as BlackjackData;
    const player = this.session.players[0];

    let description = `👤 **Jogador:** ${player.username}\n`;
    description += `💰 **Aposta:** ${data.bet} coins\n\n`;

    // Player cards
    description += `**Suas cartas:** ${this.formatCards(data.playerCards)}\n`;
    description += `**Total:** ${data.playerTotal}\n\n`;

    // Dealer cards
    const showDealerCards =
      data.gamePhase === 'dealer_turn' || data.gamePhase === 'finished';
    description += `**Dealer:** ${this.formatCards(data.dealerCards, !showDealerCards)}\n`;

    if (showDealerCards) {
      description += `**Total do Dealer:** ${data.dealerTotal}\n\n`;
    } else {
      description += `**Total do Dealer:** ${this.calculateTotal([data.dealerCards[0]])}\n\n`;
    }

    // Game result
    if (data.result) {
      let resultText = '';
      let winnings = 0;

      switch (data.result) {
        case 'blackjack':
          resultText = '🎉 **BLACKJACK!** Você ganhou!';
          winnings = Math.floor(data.bet * 2.5);
          break;
        case 'win':
          resultText = '🎉 **Você ganhou!**';
          winnings = data.bet * 2;
          break;
        case 'lose':
          resultText = '😢 **Você perdeu!**';
          winnings = 0;
          break;
        case 'push':
          resultText = '🤝 **Empate!** Sua aposta foi devolvida.';
          winnings = data.bet;
          break;
      }

      description += `${resultText}\n`;
      if (winnings > 0) {
        description += `💰 **Ganhos:** ${winnings} coins`;
      }

      this.updatePlayerScore(player.userId, winnings);
    }

    const color =
      data.result === 'win' || data.result === 'blackjack'
        ? 0x00ff00
        : data.result === 'lose'
          ? 0xff0000
          : 0xffaa00;

    return GameUtils.createGameEmbed('🃏 Blackjack', description, color);
  }

  getActionButtons() {
    const data = this.session.data as BlackjackData;

    if (data.gamePhase === 'player_turn') {
      const canDouble = data.playerCards.length === 2;

      return [
        GameUtils.createGameButtons({
          labels: ['🎯 Pedir', '✋ Parar', ...(canDouble ? ['🔥 Dobrar'] : [])],
          customIds: [
            'bj_hit',
            'bj_stand',
            ...(canDouble ? ['bj_double'] : []),
          ],
          styles: [
            ButtonStyle.Primary,
            ButtonStyle.Secondary,
            ...(canDouble ? [ButtonStyle.Danger] : []),
          ],
        }),
      ];
    }

    return [];
  }

  async finish(): Promise<GameResult> {
    const player = this.session.players[0];
    const data = this.session.data as BlackjackData;
    const rewards = this.calculateRewards(player, 1);

    // Bonus XP for blackjack or big wins
    if (data.result === 'blackjack') {
      rewards.xp += 15;
    } else if (data.result === 'win') {
      rewards.xp += 5;
    }

    return {
      sessionId: this.session.id,
      winners:
        data.result === 'win' || data.result === 'blackjack'
          ? [player.userId]
          : [],
      losers: data.result === 'lose' ? [player.userId] : [],
      rewards: { [player.userId]: rewards },
      stats: {
        result: data.result,
        playerTotal: data.playerTotal,
        dealerTotal: data.dealerTotal,
        bet: data.bet,
        cardsUsed: data.playerCards.length + data.dealerCards.length,
      },
      duration: Date.now() - this.session.startedAt.getTime(),
    };
  }

  protected getBaseXpForGame(): number {
    return 10;
  }
}
