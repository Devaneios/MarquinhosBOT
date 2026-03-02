import { ButtonStyle, EmbedBuilder } from 'discord.js';
import {
  BaseGame,
  GameResult,
  GameSession,
  PlayerStatus,
} from '../core/GameTypes';
import { GameUtils } from '../core/GameUtils';

interface TreasureHuntData {
  clues: Clue[];
  currentClueIndex: number;
  solvedClues: Record<string, number[]>;
  scores: Record<string, number>;
  finished: boolean;
  treasureFound: boolean;
  winner: string | null;
}

interface Clue {
  riddle: string;
  answer: string;
  hint?: string;
  points: number;
}

export class TreasureHuntGame extends BaseGame {
  private readonly clues: Clue[] = [
    {
      riddle:
        'Sou redondo e giro sem parar, no céu você pode me encontrar. O que sou?',
      answer: 'SOL',
      hint: 'Ilumina o dia',
      points: 20,
    },
    {
      riddle:
        'Tenho teclas mas não abro portas, faço música mas não canto. O que sou?',
      answer: 'PIANO',
      hint: 'Instrumento musical',
      points: 30,
    },
    {
      riddle:
        'Voo sem asas, choro sem olhos, onde quer que eu vá, a escuridão desaparece.',
      answer: 'NUVEM',
      hint: 'Está no céu',
      points: 40,
    },
    {
      riddle:
        'Tenho dentes mas não mordo, tenho cabelo mas não sou vivo. O que sou?',
      answer: 'PENTE',
      hint: 'Usado no cabelo',
      points: 35,
    },
    {
      riddle:
        'Sou maior que Deus, mais maligno que o diabo, os pobres me têm, os ricos precisam de mim.',
      answer: 'NADA',
      hint: 'Conceito abstrato',
      points: 50,
    },
  ];

  constructor(session: GameSession) {
    super(session);
    this.initializeGame();
  }

  private initializeGame(): void {
    const selectedClues = GameUtils.getRandomElements(this.clues, 4);

    this.session.data = {
      clues: selectedClues,
      currentClueIndex: 0,
      solvedClues: {},
      scores: {},
      finished: false,
      treasureFound: false,
      winner: null,
    } as TreasureHuntData;

    this.session.players.forEach((player) => {
      this.session.data.scores[player.userId] = 0;
      this.session.data.solvedClues[player.userId] = [];
    });
  }

  async start(): Promise<void> {
    this.session.players.forEach((p) => (p.status = PlayerStatus.ACTIVE));
  }

  async handlePlayerAction(userId: string, action: any): Promise<void> {
    const data = this.session.data as TreasureHuntData;

    if (data.finished) return;

    switch (action.type) {
      case 'solve':
        await this.submitSolution(userId, action.answer);
        break;
      case 'hint':
        // Hint costs points but is shown in embed
        data.scores[userId] = Math.max(0, data.scores[userId] - 5);
        this.updatePlayerScore(userId, data.scores[userId]);
        break;
    }
  }

  private async submitSolution(userId: string, answer: string): Promise<void> {
    const data = this.session.data as TreasureHuntData;
    const currentClue = data.clues[data.currentClueIndex];

    answer = answer.toUpperCase().trim();

    if (answer === currentClue.answer) {
      // Correct answer
      if (!data.solvedClues[userId].includes(data.currentClueIndex)) {
        data.solvedClues[userId].push(data.currentClueIndex);
        data.scores[userId] += currentClue.points;
        this.updatePlayerScore(userId, data.scores[userId]);
      }

      // Check if all clues are solved by someone
      const totalSolved = Object.values(data.solvedClues)
        .flat()
        .filter((value, index, self) => self.indexOf(value) === index).length;

      if (totalSolved === data.clues.length) {
        // All clues solved, find treasure
        await this.findTreasure();
      } else {
        // Move to next unsolved clue
        await this.nextClue();
      }
    }
  }

  private async nextClue(): Promise<void> {
    const data = this.session.data as TreasureHuntData;

    // Find next unsolved clue
    const solvedIndices = Object.values(data.solvedClues).flat();

    for (let i = 0; i < data.clues.length; i++) {
      if (!solvedIndices.includes(i)) {
        data.currentClueIndex = i;
        return;
      }
    }
  }

  private async findTreasure(): Promise<void> {
    const data = this.session.data as TreasureHuntData;

    // Player with highest score finds the treasure
    const sortedPlayers = Object.entries(data.scores).sort(
      ([, a], [, b]) => b - a,
    );

    if (sortedPlayers.length > 0) {
      data.winner = sortedPlayers[0][0];
      data.treasureFound = true;

      // Treasure bonus
      data.scores[data.winner] += 100;
      this.updatePlayerScore(data.winner, data.scores[data.winner]);
    }

    data.finished = true;
  }

  getGameEmbed(): EmbedBuilder {
    const data = this.session.data as TreasureHuntData;

    let description = '';

    if (data.finished) {
      if (data.treasureFound && data.winner) {
        const winner = this.session.players.find(
          (p) => p.userId === data.winner,
        );
        description += `🏆 **${winner?.username} encontrou o tesouro!**\n\n`;
      }

      const sortedPlayers = this.session.players.sort(
        (a, b) => (data.scores[b.userId] || 0) - (data.scores[a.userId] || 0),
      );

      description += '📊 **Pontuação Final:**\n';
      sortedPlayers.forEach((player, index) => {
        const score = data.scores[player.userId] || 0;
        const solved = data.solvedClues[player.userId]?.length || 0;
        const medal = GameUtils.getPositionMedal(index + 1);
        description += `${medal} **${player.username}** - ${score} pontos (${solved} pistas)\n`;
      });
    } else {
      const currentClue = data.clues[data.currentClueIndex];
      description += `🗺️ **Caça ao Tesouro - Pista ${data.currentClueIndex + 1}**\n\n`;
      description += `**Enigma:**\n${currentClue.riddle}\n\n`;

      // Show current scores
      const sortedPlayers = this.session.players.sort(
        (a, b) => (data.scores[b.userId] || 0) - (data.scores[a.userId] || 0),
      );

      description += '🏅 **Pontuação Atual:**\n';
      sortedPlayers.forEach((player, index) => {
        const score = data.scores[player.userId] || 0;
        const solved = data.solvedClues[player.userId]?.length || 0;
        description += `${index + 1}. **${player.username}** - ${score} pts (${solved}/${data.clues.length} pistas)\n`;
      });
    }

    const color = data.finished ? 0x00ff00 : 0xf39c12;

    return GameUtils.createGameEmbed('🗺️ Caça ao Tesouro', description, color);
  }

  getActionButtons() {
    const data = this.session.data as TreasureHuntData;

    if (data.finished) return [];

    const currentClue = data.clues[data.currentClueIndex];

    return [
      GameUtils.createGameButtons({
        labels: [
          '🔍 Responder',
          ...(currentClue.hint ? ['💡 Dica (-5 pts)'] : []),
        ],
        customIds: ['hunt_answer', ...(currentClue.hint ? ['hunt_hint'] : [])],
        styles: [
          ButtonStyle.Primary,
          ...(currentClue.hint ? [ButtonStyle.Secondary] : []),
        ],
      }),
    ];
  }

  async finish(): Promise<GameResult> {
    const data = this.session.data as TreasureHuntData;
    const sortedPlayers = this.session.players.sort(
      (a, b) => (data.scores[b.userId] || 0) - (data.scores[a.userId] || 0),
    );

    const rewards: Record<string, any> = {};

    sortedPlayers.forEach((player, index) => {
      const baseRewards = this.calculateRewards(player, index + 1);
      const score = data.scores[player.userId] || 0;
      const solvedCount = data.solvedClues[player.userId]?.length || 0;

      baseRewards.xp += Math.floor(score / 5);
      baseRewards.xp += solvedCount * 5;

      if (player.userId === data.winner) {
        baseRewards.xp += 30; // Treasure finder bonus
      }

      rewards[player.userId] = baseRewards;
    });

    return {
      sessionId: this.session.id,
      winners: sortedPlayers.length > 0 ? [sortedPlayers[0].userId] : [],
      losers: sortedPlayers.slice(1).map((p) => p.userId),
      rewards,
      stats: {
        treasureFound: data.treasureFound,
        winner: data.winner,
        cluesSolved: data.clues.length,
        averageScore:
          Object.values(data.scores).reduce((a, b) => a + b, 0) /
          this.session.players.length,
      },
      duration: Date.now() - this.session.startedAt.getTime(),
    };
  }

  protected getBaseXpForGame(): number {
    return 50;
  }
}
