import { EmbedBuilder, ButtonStyle } from 'discord.js';
import {
  BaseGame,
  GameSession,
  GameResult,
  PlayerStatus,
} from '../core/GameTypes';
import { GameUtils } from '../core/GameUtils';

interface RhymeData {
  targetWord: string;
  validRhymes: string[];
  playerRhymes: Record<string, string[]>;
  scores: Record<string, number>;
  timeLimit: number;
  startTime: number;
  finished: boolean;
}

export class RhymeGame extends BaseGame {
  private readonly rhymeWords = [
    {
      word: 'AMOR',
      rhymes: [
        'DOR',
        'FLOR',
        'COR',
        'SENHOR',
        'VALOR',
        'CALOR',
        'TAMBOR',
        'SABOR',
        'TERROR',
        'RUMOR',
      ],
    },
    {
      word: 'CASA',
      rhymes: [
        'MASSA',
        'PASSA',
        'PRASSA',
        'CAÇA',
        'PRAÇA',
        'RAÇA',
        'GRAÇA',
        'ESPAÇA',
        'ABRAÇA',
      ],
    },
    {
      word: 'CORAÇÃO',
      rhymes: [
        'AÇÃO',
        'PAIXÃO',
        'EMOÇÃO',
        'CANÇÃO',
        'LIÇÃO',
        'RAZÃO',
        'PRESSÃO',
        'VERSÃO',
        'MISSÃO',
      ],
    },
    {
      word: 'VIDA',
      rhymes: [
        'BEBIDA',
        'COMIDA',
        'PERDIDA',
        'QUERIDA',
        'FERIDA',
        'PARTIDA',
        'SAÍDA',
        'CORRIDA',
      ],
    },
    {
      word: 'FELIZ',
      rhymes: [
        'NARIZ',
        'RAIZ',
        'CICATRIZ',
        'DESLIZ',
        'CHAFARIZ',
        'MATRIZ',
        'MOTRIZ',
        'ATRIZ',
      ],
    },
    {
      word: 'CANTAR',
      rhymes: [
        'AMAR',
        'SONHAR',
        'VOAR',
        'DANÇAR',
        'BRINCAR',
        'ESTUDAR',
        'TRABALHAR',
        'JOGAR',
      ],
    },
  ];

  constructor(session: GameSession) {
    super(session);
    this.initializeGame();
  }

  private initializeGame(): void {
    const selectedRhyme = GameUtils.getRandomElement(this.rhymeWords);

    this.session.data = {
      targetWord: selectedRhyme.word,
      validRhymes: selectedRhyme.rhymes,
      playerRhymes: {},
      scores: {},
      timeLimit: 90, // 90 seconds
      startTime: Date.now(),
      finished: false,
    } as RhymeData;

    this.session.players.forEach((player) => {
      this.session.data.playerRhymes[player.userId] = [];
      this.session.data.scores[player.userId] = 0;
    });
  }

  async start(): Promise<void> {
    this.session.players.forEach((p) => (p.status = PlayerStatus.ACTIVE));
  }

  async handlePlayerAction(userId: string, action: any): Promise<void> {
    const data = this.session.data as RhymeData;

    if (data.finished || this.isTimeUp()) return;

    if (action.type === 'rhyme') {
      await this.submitRhyme(userId, action.word);
    }
  }

  private async submitRhyme(userId: string, rhyme: string): Promise<void> {
    const data = this.session.data as RhymeData;

    rhyme = rhyme.toUpperCase().trim();

    if (!rhyme || data.playerRhymes[userId].includes(rhyme)) return;

    // Check if it's a valid rhyme
    const isValid = data.validRhymes.includes(rhyme);

    // Check if already used by another player
    const alreadyUsed = Object.values(data.playerRhymes).flat().includes(rhyme);

    if (isValid && !alreadyUsed) {
      data.playerRhymes[userId].push(rhyme);
      data.scores[userId] += this.calculatePoints(rhyme);
      this.updatePlayerScore(userId, data.scores[userId]);
    }
  }

  private calculatePoints(rhyme: string): number {
    // Longer words give more points
    const basePoints = rhyme.length * 2;
    const difficultyBonus = rhyme.length > 6 ? 10 : 0;
    return basePoints + difficultyBonus;
  }

  private isTimeUp(): boolean {
    const data = this.session.data as RhymeData;
    return Date.now() - data.startTime > data.timeLimit * 1000;
  }

  getGameEmbed(): EmbedBuilder {
    const data = this.session.data as RhymeData;
    const timeRemaining = Math.max(
      0,
      data.timeLimit - Math.floor((Date.now() - data.startTime) / 1000),
    );

    let description = '';

    if (this.isTimeUp()) {
      description += '⏰ **Tempo esgotado!**\n\n';
      data.finished = true;
    } else {
      description += '🎤 **Encontre palavras que rimam!**\n\n';
    }

    description += `**Palavra:** ${data.targetWord}\n`;

    if (!data.finished) {
      description += `⏱️ **Tempo restante:** ${timeRemaining}s\n\n`;
    } else {
      description += '\n';
    }

    description += '🏆 **Pontuação:**\n';

    // Sort players by score
    const sortedPlayers = this.session.players.sort(
      (a, b) => (data.scores[b.userId] || 0) - (data.scores[a.userId] || 0),
    );

    sortedPlayers.forEach((player, index) => {
      const score = data.scores[player.userId] || 0;
      const rhymes = data.playerRhymes[player.userId] || [];
      const medal = GameUtils.getPositionMedal(index + 1);

      description += `${medal} **${player.username}**: ${score} pontos\n`;
      if (rhymes.length > 0) {
        description += `   Rimas: ${rhymes.join(', ')}\n`;
      }
    });

    // Show some example rhymes if finished
    if (data.finished) {
      const usedRhymes = Object.values(data.playerRhymes).flat();
      const unusedRhymes = data.validRhymes.filter(
        (r) => !usedRhymes.includes(r),
      );

      if (unusedRhymes.length > 0) {
        description += `\n💡 **Outras rimas possíveis:** ${unusedRhymes.slice(0, 5).join(', ')}`;
        if (unusedRhymes.length > 5) {
          description += ` e mais ${unusedRhymes.length - 5}...`;
        }
      }
    }

    const color = data.finished ? 0x00ff00 : 0xff6b9d;

    return GameUtils.createGameEmbed('🎤 Rima Rápida', description, color);
  }

  getActionButtons() {
    const data = this.session.data as RhymeData;

    if (data.finished || this.isTimeUp()) return [];

    return [
      GameUtils.createGameButtons({
        labels: ['📝 Digite uma rima'],
        customIds: ['rhyme_input'],
        styles: [ButtonStyle.Primary],
      }),
    ];
  }

  async finish(): Promise<GameResult> {
    const data = this.session.data as RhymeData;
    const sortedPlayers = this.session.players.sort(
      (a, b) => (data.scores[b.userId] || 0) - (data.scores[a.userId] || 0),
    );

    const winners = sortedPlayers.slice(0, Math.min(3, sortedPlayers.length));
    const rewards: Record<string, any> = {};

    sortedPlayers.forEach((player, index) => {
      const baseRewards = this.calculateRewards(player, index + 1);
      const score = data.scores[player.userId] || 0;

      // Bonus XP based on performance
      baseRewards.xp += Math.floor(score / 5);

      rewards[player.userId] = baseRewards;
    });

    return {
      sessionId: this.session.id,
      winners: winners.map((p) => p.userId),
      losers: [],
      rewards,
      stats: {
        targetWord: data.targetWord,
        totalRhymesFound: Object.values(data.playerRhymes).flat().length,
        possibleRhymes: data.validRhymes.length,
        averageScore:
          Object.values(data.scores).reduce((a, b) => a + b, 0) /
          this.session.players.length,
        highestScore: Math.max(...Object.values(data.scores)),
      },
      duration: Date.now() - this.session.startedAt.getTime(),
    };
  }

  protected getBaseXpForGame(): number {
    return 15;
  }
}
