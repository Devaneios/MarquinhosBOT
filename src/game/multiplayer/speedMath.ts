import { EmbedBuilder } from 'discord.js';
import {
  BaseGame,
  GameResult,
  GameSession,
  PlayerStatus,
} from '../core/GameTypes';
import { GameUtils } from '../core/GameUtils';

interface SpeedMathData {
  questions: MathQuestion[];
  currentQuestionIndex: number;
  scores: Record<string, number>;
  answered: Record<string, { answer: number; time: number }>;
  questionStartTime: number;
  finished: boolean;
}

interface MathQuestion {
  question: string;
  answer: number;
  difficulty: number;
}

export class SpeedMathGame extends BaseGame {
  constructor(session: GameSession) {
    super(session);
    this.initializeGame();
  }

  private initializeGame(): void {
    this.session.data = {
      questions: this.generateQuestions(10),
      currentQuestionIndex: 0,
      scores: {},
      answered: {},
      questionStartTime: Date.now(),
      finished: false,
    } as SpeedMathData;

    this.session.players.forEach((player) => {
      this.session.data.scores[player.userId] = 0;
    });
  }

  private generateQuestions(count: number): MathQuestion[] {
    const questions: MathQuestion[] = [];

    for (let i = 0; i < count; i++) {
      const type = Math.floor(Math.random() * 4);
      let question: MathQuestion;

      switch (type) {
        case 0: // Addition
          question = this.generateAddition();
          break;
        case 1: // Subtraction
          question = this.generateSubtraction();
          break;
        case 2: // Multiplication
          question = this.generateMultiplication();
          break;
        case 3: // Division
          question = this.generateDivision();
          break;
        default:
          question = this.generateAddition();
      }

      questions.push(question);
    }

    return questions;
  }

  private generateAddition(): MathQuestion {
    const a = Math.floor(Math.random() * 50) + 1;
    const b = Math.floor(Math.random() * 50) + 1;
    return {
      question: `${a} + ${b}`,
      answer: a + b,
      difficulty: 1,
    };
  }

  private generateSubtraction(): MathQuestion {
    const a = Math.floor(Math.random() * 50) + 25;
    const b = Math.floor(Math.random() * 24) + 1;
    return {
      question: `${a} - ${b}`,
      answer: a - b,
      difficulty: 1,
    };
  }

  private generateMultiplication(): MathQuestion {
    const a = Math.floor(Math.random() * 12) + 1;
    const b = Math.floor(Math.random() * 12) + 1;
    return {
      question: `${a} × ${b}`,
      answer: a * b,
      difficulty: 2,
    };
  }

  private generateDivision(): MathQuestion {
    const b = Math.floor(Math.random() * 10) + 2;
    const answer = Math.floor(Math.random() * 10) + 1;
    const a = b * answer;
    return {
      question: `${a} ÷ ${b}`,
      answer: answer,
      difficulty: 2,
    };
  }

  async start(): Promise<void> {
    this.session.players.forEach((p) => (p.status = PlayerStatus.ACTIVE));
  }

  async handlePlayerAction(userId: string, action: any): Promise<void> {
    const data = this.session.data as SpeedMathData;

    if (data.finished || data.answered[userId]) return;

    if (action.type === 'answer') {
      await this.submitAnswer(userId, action.answer);
    }
  }

  private async submitAnswer(userId: string, answer: number): Promise<void> {
    const data = this.session.data as SpeedMathData;
    const currentQuestion = data.questions[data.currentQuestionIndex];
    const responseTime = Date.now() - data.questionStartTime;

    data.answered[userId] = { answer, time: responseTime };

    if (answer === currentQuestion.answer) {
      const points = this.calculatePoints(
        responseTime,
        currentQuestion.difficulty,
      );
      data.scores[userId] += points;
      this.updatePlayerScore(userId, data.scores[userId]);
    }

    const allAnswered = this.session.players.every(
      (p) => data.answered[p.userId],
    );

    if (allAnswered) {
      await this.nextQuestion();
    }
  }

  private calculatePoints(responseTime: number, difficulty: number): number {
    const basePoints = 10 * difficulty;
    const timeBonus = Math.max(0, 10 - Math.floor(responseTime / 1000));
    return basePoints + timeBonus;
  }

  private async nextQuestion(): Promise<void> {
    const data = this.session.data as SpeedMathData;

    await GameUtils.delay(2000); // Show results for 2 seconds

    data.currentQuestionIndex++;
    data.answered = {};
    data.questionStartTime = Date.now();

    if (data.currentQuestionIndex >= data.questions.length) {
      data.finished = true;
    }
  }

  getGameEmbed(): EmbedBuilder {
    const data = this.session.data as SpeedMathData;

    if (data.finished) {
      return this.getResultsEmbed();
    }

    const currentQuestion = data.questions[data.currentQuestionIndex];

    let description = `**Questão ${data.currentQuestionIndex + 1}/${data.questions.length}**\n\n`;
    description += `🧮 **${currentQuestion.question} = ?**\n\n`;

    // Show who answered
    const answeredPlayers = Object.keys(data.answered);
    if (answeredPlayers.length > 0) {
      description += `✅ **Responderam:**\n`;
      answeredPlayers.forEach((userId) => {
        const player = this.session.players.find((p) => p.userId === userId);
        const answerData = data.answered[userId];
        const isCorrect = answerData.answer === currentQuestion.answer;
        const emoji = isCorrect ? '✅' : '❌';
        description += `${emoji} ${player?.username} - ${answerData.answer} (${(answerData.time / 1000).toFixed(1)}s)\n`;
      });
    }

    // Current scores
    const sortedPlayers = this.session.players.sort(
      (a, b) => (data.scores[b.userId] || 0) - (data.scores[a.userId] || 0),
    );

    description += `\n📊 **Pontuação:**\n`;
    sortedPlayers.forEach((player, index) => {
      const score = data.scores[player.userId] || 0;
      const medal = GameUtils.getPositionMedal(index + 1);
      description += `${medal} ${player.username}: ${score}\n`;
    });

    return GameUtils.createGameEmbed('➕ Speed Math', description, 0x3498db);
  }

  private getResultsEmbed(): EmbedBuilder {
    const data = this.session.data as SpeedMathData;
    const sortedPlayers = this.session.players.sort(
      (a, b) => (data.scores[b.userId] || 0) - (data.scores[a.userId] || 0),
    );

    let description = '🏁 **Resultados Finais!**\n\n';

    sortedPlayers.forEach((player, index) => {
      const position = index + 1;
      const score = data.scores[player.userId] || 0;
      const medal = GameUtils.getPositionMedal(position);
      description += `${medal} **${player.username}** - ${score} pontos\n`;
    });

    return GameUtils.createGameEmbed(
      '🏆 Speed Math - Resultados',
      description,
      0x00ff00,
    );
  }

  async finish(): Promise<GameResult> {
    const data = this.session.data as SpeedMathData;
    const sortedPlayers = this.session.players.sort(
      (a, b) => (data.scores[b.userId] || 0) - (data.scores[a.userId] || 0),
    );

    const winners = sortedPlayers.slice(0, Math.min(3, sortedPlayers.length));
    const rewards: Record<string, any> = {};

    sortedPlayers.forEach((player, index) => {
      const baseRewards = this.calculateRewards(player, index + 1);
      const score = data.scores[player.userId] || 0;
      baseRewards.xp += Math.floor(score / 3);
      rewards[player.userId] = baseRewards;
    });

    return {
      sessionId: this.session.id,
      winners: winners.map((p) => p.userId),
      losers: [],
      rewards,
      stats: {
        questionsAnswered: data.questions.length,
        averageScore:
          Object.values(data.scores).reduce((a, b) => a + b, 0) /
          this.session.players.length,
        highestScore: Math.max(...Object.values(data.scores)),
      },
      duration: Date.now() - this.session.startedAt.getTime(),
    };
  }

  protected getBaseXpForGame(): number {
    return 10;
  }
}
