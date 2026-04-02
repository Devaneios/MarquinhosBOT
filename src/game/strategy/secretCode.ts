import { EmbedBuilder } from 'discord.js';
import {
  BaseGame,
  GameResult,
  GameSession,
  PlayerStatus,
} from '../core/GameTypes';
import { GameUtils } from '../core/GameUtils';

interface SecretCodeData {
  secretCode: number[];
  guesses: CodeGuess[];
  maxAttempts: number;
  won: boolean;
  gameOver: boolean;
}

interface CodeGuess {
  code: number[];
  exact: number; // Correct digit in correct position
  partial: number; // Correct digit in wrong position
}

export class SecretCodeGame extends BaseGame {
  constructor(session: GameSession) {
    super(session);
    this.initializeGame();
  }

  private initializeGame(): void {
    this.session.data = {
      secretCode: this.generateSecretCode(),
      guesses: [],
      maxAttempts: 10,
      won: false,
      gameOver: false,
    } as SecretCodeData;
  }

  private generateSecretCode(): number[] {
    const code = [];
    const availableDigits = [1, 2, 3, 4, 5, 6];

    for (let i = 0; i < 4; i++) {
      const randomIndex = Math.floor(Math.random() * availableDigits.length);
      code.push(availableDigits.splice(randomIndex, 1)[0]);
    }

    return code;
  }

  async start(): Promise<void> {
    this.session.players[0].status = PlayerStatus.ACTIVE;
  }

  async handlePlayerAction(
    userId: string,
    action: Record<string, unknown>,
  ): Promise<void> {
    const data = this.session.data as SecretCodeData;

    if (data.gameOver) return;

    if (action.type === 'guess') {
      await this.submitGuess(action.code as number[]);
    }
  }

  private async submitGuess(guessCode: number[]): Promise<void> {
    const data = this.session.data as SecretCodeData;

    if (guessCode.length !== 4) return;

    const result = this.evaluateGuess(guessCode);
    data.guesses.push(result);

    if (result.exact === 4) {
      data.won = true;
      data.gameOver = true;
      await this.updateScores();
    } else if (data.guesses.length >= data.maxAttempts) {
      data.gameOver = true;
      await this.updateScores();
    }
  }

  private evaluateGuess(guess: number[]): CodeGuess {
    const data = this.session.data as SecretCodeData;
    let exact = 0;
    let partial = 0;

    const secretCopy = [...data.secretCode];
    const guessCopy = [...guess];

    // Check for exact matches
    for (let i = 3; i >= 0; i--) {
      if (guessCopy[i] === secretCopy[i]) {
        exact++;
        secretCopy.splice(i, 1);
        guessCopy.splice(i, 1);
      }
    }

    // Check for partial matches
    for (const digit of guessCopy) {
      const index = secretCopy.indexOf(digit);
      if (index !== -1) {
        partial++;
        secretCopy.splice(index, 1);
      }
    }

    return {
      code: guess,
      exact,
      partial,
    };
  }

  private async updateScores(): Promise<void> {
    const data = this.session.data as SecretCodeData;

    if (data.won) {
      const baseScore = 200;
      const attemptBonus = (data.maxAttempts - data.guesses.length) * 10;
      const score = baseScore + attemptBonus;

      this.updatePlayerScore(this.session.players[0].userId, score);
    }
  }

  getGameEmbed(): EmbedBuilder {
    const data = this.session.data as SecretCodeData;
    const player = this.session.players[0];

    let description = `👤 **Jogador:** ${player.username}\n\n`;

    if (data.gameOver) {
      if (data.won) {
        description += `🎉 **PARABÉNS! Você quebrou o código!**\n`;
        description += `🔐 **Código:** ${data.secretCode.join(' ')}\n`;
        description += `🎯 **Tentativas:** ${data.guesses.length}/${data.maxAttempts}\n\n`;
      } else {
        description += `😢 **Você não conseguiu quebrar o código!**\n`;
        description += `🔐 **O código era:** ${data.secretCode.join(' ')}\n\n`;
      }
    } else {
      description += `🔐 **Quebre o código de 4 dígitos!**\n`;
      description += `🎯 **Tentativas restantes:** ${data.maxAttempts - data.guesses.length}\n`;
      description += `🔢 **Use dígitos de 1 a 6 (sem repetir)**\n\n`;
    }

    // Show guesses history
    if (data.guesses.length > 0) {
      description += `**Histórico de tentativas:**\n`;
      data.guesses.forEach((guess, index) => {
        description += `${index + 1}. ${guess.code.join(' ')} - `;
        description += `🎯 ${guess.exact} exatos, 🔄 ${guess.partial} parciais\n`;
      });
    }

    description += `\n💡 **Dica:** 🎯 = posição correta, 🔄 = dígito correto mas posição errada`;

    const color = data.gameOver ? (data.won ? 0x00ff00 : 0xff0000) : 0x3498db;

    return GameUtils.createGameEmbed('🔐 Código Secreto', description, color);
  }

  async finish(): Promise<GameResult> {
    const data = this.session.data as SecretCodeData;
    const player = this.session.players[0];
    const rewards = this.calculateRewards(player, 1);

    if (data.won) {
      rewards.xp += 25;
      rewards.xp += (data.maxAttempts - data.guesses.length) * 2;
    }

    return {
      sessionId: this.session.id,
      winners: data.won ? [player.userId] : [],
      losers: !data.won ? [player.userId] : [],
      rewards: { [player.userId]: rewards },
      stats: {
        won: data.won,
        attempts: data.guesses.length,
        maxAttempts: data.maxAttempts,
        secretCode: data.secretCode,
      },
      duration: Date.now() - this.session.startedAt.getTime(),
    };
  }

  protected getBaseXpForGame(): number {
    return 25;
  }
}
