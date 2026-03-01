import { EmbedBuilder, ButtonStyle } from 'discord.js';
import {
  BaseGame,
  GameSession,
  GameResult,
  PlayerStatus,
} from '../core/GameTypes';
import { GameUtils } from '../core/GameUtils';

interface BattleRoyaleData {
  round: number;
  alivePlayers: string[];
  eliminatedPlayers: string[];
  currentChallenge: Challenge;
  responses: Record<string, string>;
  finished: boolean;
}

interface Challenge {
  type: 'emoji_combo' | 'riddle' | 'quick_choice';
  question: string;
  correctAnswer: string;
  options?: string[];
  timeLimit: number;
}

export class BattleRoyaleGame extends BaseGame {
  private readonly challenges = [
    {
      type: 'emoji_combo',
      question: 'Qual filme este emoji representa? 🦁👑',
      correctAnswer: 'REI LEAO',
      timeLimit: 15,
    },
    {
      type: 'quick_choice',
      question: 'Qual é mais rápido?',
      options: ['Guepardo', 'Falcão', 'Tubarão'],
      correctAnswer: 'Falcão',
      timeLimit: 10,
    },
    {
      type: 'riddle',
      question: 'O que é que quanto mais se tira, maior fica?',
      correctAnswer: 'BURACO',
      timeLimit: 20,
    },
  ] as Challenge[];

  constructor(session: GameSession) {
    super(session);
    this.initializeGame();
  }

  private initializeGame(): void {
    this.session.data = {
      round: 1,
      alivePlayers: this.session.players.map((p) => p.userId),
      eliminatedPlayers: [],
      currentChallenge: this.getRandomChallenge(),
      responses: {},
      finished: false,
    } as BattleRoyaleData;
  }

  private getRandomChallenge(): Challenge {
    return GameUtils.getRandomElement(this.challenges);
  }

  async start(): Promise<void> {
    this.session.players.forEach((p) => (p.status = PlayerStatus.ACTIVE));
  }

  async handlePlayerAction(userId: string, action: any): Promise<void> {
    const data = this.session.data as BattleRoyaleData;

    if (data.finished || !data.alivePlayers.includes(userId)) return;

    if (action.type === 'respond') {
      await this.submitResponse(userId, action.response);
    }
  }

  private async submitResponse(
    userId: string,
    response: string,
  ): Promise<void> {
    const data = this.session.data as BattleRoyaleData;
    data.responses[userId] = response.toUpperCase();

    const allResponded = data.alivePlayers.every((id) => data.responses[id]);

    if (allResponded) {
      await this.processRound();
    }
  }

  private async processRound(): Promise<void> {
    const data = this.session.data as BattleRoyaleData;
    const correctPlayers = [];
    const wrongPlayers = [];

    data.alivePlayers.forEach((userId) => {
      const response = data.responses[userId];
      if (response === data.currentChallenge.correctAnswer) {
        correctPlayers.push(userId);
      } else {
        wrongPlayers.push(userId);
      }
    });

    // Eliminate wrong players or least performers
    if (correctPlayers.length > 0 && wrongPlayers.length > 0) {
      // Eliminate wrong players
      data.eliminatedPlayers.push(...wrongPlayers);
      data.alivePlayers = correctPlayers;
    } else if (correctPlayers.length === 0) {
      // Everyone was wrong, eliminate randomly
      const toEliminate = GameUtils.getRandomElement(data.alivePlayers);
      data.eliminatedPlayers.push(toEliminate);
      data.alivePlayers = data.alivePlayers.filter((id) => id !== toEliminate);
    }

    // Check if game should end
    if (data.alivePlayers.length <= 1) {
      data.finished = true;
      await this.updateScores();
    } else {
      // Next round
      data.round++;
      data.currentChallenge = this.getRandomChallenge();
      data.responses = {};
    }
  }

  private async updateScores(): Promise<void> {
    const data = this.session.data as BattleRoyaleData;

    // Winner gets highest score
    if (data.alivePlayers.length === 1) {
      this.updatePlayerScore(data.alivePlayers[0], 100);
    }

    // Participants get points based on survival
    data.eliminatedPlayers.forEach((userId, index) => {
      const survivalBonus = Math.max(10, 60 - index * 5);
      this.updatePlayerScore(userId, survivalBonus);
    });
  }

  getGameEmbed(): EmbedBuilder {
    const data = this.session.data as BattleRoyaleData;

    let description = `⚔️ **Battle Royale - Rodada ${data.round}**\n\n`;

    if (data.finished) {
      if (data.alivePlayers.length === 1) {
        const winner = this.session.players.find(
          (p) => p.userId === data.alivePlayers[0],
        );
        description += `👑 **VENCEDOR: ${winner?.username}!**\n\n`;
      }
      description += `**Ordem de eliminação:**\n`;
      data.eliminatedPlayers.reverse().forEach((userId, index) => {
        const player = this.session.players.find((p) => p.userId === userId);
        description += `${index + 2}. ${player?.username}\n`;
      });
    } else {
      description += `**Desafio:**\n${data.currentChallenge.question}\n\n`;

      if (data.currentChallenge.options) {
        description += `**Opções:**\n`;
        data.currentChallenge.options.forEach((option, index) => {
          description += `${String.fromCharCode(65 + index)}) ${option}\n`;
        });
        description += '\n';
      }

      description += `👥 **Jogadores vivos:** ${data.alivePlayers.length}\n`;
      description += `💀 **Eliminados:** ${data.eliminatedPlayers.length}\n\n`;

      const respondedCount = Object.keys(data.responses).length;
      description += `📝 **Respostas:** ${respondedCount}/${data.alivePlayers.length}`;
    }

    const color = data.finished ? 0x00ff00 : 0xff4757;

    return GameUtils.createGameEmbed(
      '⚔️ Battle Royale dos Emojis',
      description,
      color,
    );
  }

  async finish(): Promise<GameResult> {
    const data = this.session.data as BattleRoyaleData;
    const rewards: Record<string, any> = {};

    // Winner
    if (data.alivePlayers.length === 1) {
      const winner = data.alivePlayers[0];
      const winnerRewards = this.calculateRewards(
        this.session.players.find((p) => p.userId === winner)!,
        1,
      );
      winnerRewards.xp += 40;
      rewards[winner] = winnerRewards;
    }

    // Other players
    data.eliminatedPlayers.forEach((userId, index) => {
      const player = this.session.players.find((p) => p.userId === userId)!;
      const position = data.eliminatedPlayers.length - index + 1;
      const baseRewards = this.calculateRewards(player, position);
      baseRewards.xp += Math.max(5, 25 - index * 2);
      rewards[userId] = baseRewards;
    });

    return {
      sessionId: this.session.id,
      winners: data.alivePlayers,
      losers: data.eliminatedPlayers,
      rewards,
      stats: {
        rounds: data.round,
        finalParticipants: data.alivePlayers.length,
        eliminated: data.eliminatedPlayers.length,
      },
      duration: Date.now() - this.session.startedAt.getTime(),
    };
  }

  protected getBaseXpForGame(): number {
    return 40;
  }
}
