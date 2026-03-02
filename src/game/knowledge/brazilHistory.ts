import { ButtonStyle, EmbedBuilder } from 'discord.js';
import {
  BaseGame,
  GameQuestion,
  GameResult,
  GameSession,
  PlayerStatus,
} from '../core/GameTypes';
import { GameUtils } from '../core/GameUtils';

interface BrazilHistoryData {
  questions: GameQuestion[];
  currentQuestionIndex: number;
  scores: Record<string, number>;
  answered: Record<string, boolean>;
  timeLimit: number;
  questionStartTime: number;
  finished: boolean;
}

export class BrazilHistoryGame extends BaseGame {
  private readonly historyQuestions: GameQuestion[] = [
    {
      id: '1',
      question: '🇧🇷 Em que ano o Brasil foi descoberto?',
      options: ['1498', '1500', '1502', '1504'],
      correctAnswer: 1,
      difficulty: 'easy',
      category: 'Colonial',
      explanation:
        'Pedro Álvares Cabral chegou ao Brasil em 22 de abril de 1500',
    },
    {
      id: '2',
      question: '👑 Quem foi o primeiro imperador do Brasil?',
      options: ['Dom Pedro I', 'Dom Pedro II', 'Dom João VI', 'Getúlio Vargas'],
      correctAnswer: 0,
      difficulty: 'easy',
      category: 'Império',
      explanation:
        'Dom Pedro I proclamou a independência e se tornou o primeiro imperador',
    },
    {
      id: '3',
      question: '📜 Em que ano foi assinada a Lei Áurea?',
      options: ['1885', '1888', '1889', '1891'],
      correctAnswer: 1,
      difficulty: 'medium',
      category: 'Império',
      explanation:
        'A Princesa Isabel assinou a Lei Áurea em 13 de maio de 1888',
    },
    {
      id: '4',
      question: '🏗️ Quem foi o fundador de Brasília?',
      options: [
        'Getúlio Vargas',
        'Juscelino Kubitschek',
        'Tancredo Neves',
        'Café Filho',
      ],
      correctAnswer: 1,
      difficulty: 'easy',
      category: 'República',
      explanation: 'JK construiu Brasília durante seu governo (1956-1961)',
    },
    {
      id: '5',
      question: '⚔️ Qual foi a maior revolta do período regencial?',
      options: ['Cabanagem', 'Guerra dos Farrapos', 'Balaiada', 'Sabinada'],
      correctAnswer: 1,
      difficulty: 'hard',
      category: 'Regência',
      explanation: 'A Guerra dos Farrapos durou 10 anos (1835-1845)',
    },
    {
      id: '6',
      question: '🎭 Qual movimento cultural marcou a semana de 1922?',
      options: ['Tropicalismo', 'Modernismo', 'Romantismo', 'Parnasianismo'],
      correctAnswer: 1,
      difficulty: 'medium',
      category: 'Cultura',
      explanation:
        'A Semana de Arte Moderna de 1922 marcou o Modernismo brasileiro',
    },
    {
      id: '7',
      question: '🌾 Qual produto foi a base da economia colonial?',
      options: ['Ouro', 'Café', 'Açúcar', 'Borracha'],
      correctAnswer: 2,
      difficulty: 'easy',
      category: 'Colonial',
      explanation:
        'A cana-de-açúcar foi o primeiro grande produto de exportação',
    },
    {
      id: '8',
      question: '🏛️ Quando foi proclamada a República?',
      options: [
        '15 de novembro de 1889',
        '7 de setembro de 1822',
        '13 de maio de 1888',
        '15 de novembro de 1891',
      ],
      correctAnswer: 0,
      difficulty: 'medium',
      category: 'República',
      explanation:
        'O Marechal Deodoro da Fonseca proclamou a República em 15 de novembro de 1889',
    },
    {
      id: '9',
      question: '💰 Qual presidente criou o Plano Real?',
      options: [
        'José Sarney',
        'Fernando Collor',
        'Itamar Franco',
        'Fernando Henrique',
      ],
      correctAnswer: 2,
      difficulty: 'medium',
      category: 'República Nova',
      explanation: 'O Plano Real foi criado no governo Itamar Franco em 1994',
    },
    {
      id: '10',
      question: '📚 Quem escreveu "O Guarani"?',
      options: [
        'Machado de Assis',
        'José de Alencar',
        'Castro Alves',
        'Gonçalves Dias',
      ],
      correctAnswer: 1,
      difficulty: 'medium',
      category: 'Literatura',
      explanation: 'José de Alencar é autor de "O Guarani" (1857)',
    },
  ];

  constructor(session: GameSession) {
    super(session);
    this.initializeGame();
  }

  private initializeGame(): void {
    const selectedQuestions = GameUtils.getRandomElements(
      this.historyQuestions,
      6,
    );

    this.session.data = {
      questions: selectedQuestions,
      currentQuestionIndex: 0,
      scores: {},
      answered: {},
      timeLimit: 45,
      questionStartTime: Date.now(),
      finished: false,
    } as BrazilHistoryData;

    this.session.players.forEach((player) => {
      this.session.data.scores[player.userId] = 0;
    });
  }

  async start(): Promise<void> {
    this.session.players.forEach((p) => (p.status = PlayerStatus.ACTIVE));
    this.session.data.questionStartTime = Date.now();
  }

  async handlePlayerAction(userId: string, action: any): Promise<void> {
    const data = this.session.data as BrazilHistoryData;

    if (data.finished || data.answered[userId]) return;

    if (action.type === 'answer') {
      await this.submitAnswer(userId, action.answer);
    }
  }

  private async submitAnswer(userId: string, answer: number): Promise<void> {
    const data = this.session.data as BrazilHistoryData;
    const currentQuestion = data.questions[data.currentQuestionIndex];

    data.answered[userId] = true;

    if (answer === currentQuestion.correctAnswer) {
      const timeBonus = this.calculateTimeBonus();
      const difficultyBonus = this.getDifficultyBonus(
        currentQuestion.difficulty,
      );
      const points = 100 + timeBonus + difficultyBonus;
      data.scores[userId] += points;
      this.updatePlayerScore(userId, data.scores[userId]);
    }

    const allAnswered = this.session.players.every(
      (p) => data.answered[p.userId],
    );
    const timeUp = Date.now() - data.questionStartTime > data.timeLimit * 1000;

    if (allAnswered || timeUp) {
      await this.nextQuestion();
    }
  }

  private calculateTimeBonus(): number {
    const data = this.session.data as BrazilHistoryData;
    const elapsed = Date.now() - data.questionStartTime;
    const remaining = Math.max(0, data.timeLimit * 1000 - elapsed);
    return Math.floor((remaining / (data.timeLimit * 1000)) * 50);
  }

  private getDifficultyBonus(difficulty: string): number {
    switch (difficulty) {
      case 'easy':
        return 0;
      case 'medium':
        return 25;
      case 'hard':
        return 50;
      default:
        return 0;
    }
  }

  private async nextQuestion(): Promise<void> {
    const data = this.session.data as BrazilHistoryData;

    data.currentQuestionIndex++;
    data.answered = {};
    data.questionStartTime = Date.now();

    if (data.currentQuestionIndex >= data.questions.length) {
      data.finished = true;
    }
  }

  getGameEmbed(): EmbedBuilder {
    const data = this.session.data as BrazilHistoryData;

    if (data.finished) {
      return this.getResultsEmbed();
    }

    const currentQuestion = data.questions[data.currentQuestionIndex];
    const timeRemaining = Math.max(
      0,
      data.timeLimit - Math.floor((Date.now() - data.questionStartTime) / 1000),
    );

    let description = `**Pergunta ${data.currentQuestionIndex + 1}/${data.questions.length}**\n\n`;
    description += `${currentQuestion.question}\n\n`;

    currentQuestion.options?.forEach((option, index) => {
      const letter = String.fromCharCode(65 + index);
      description += `**${letter})** ${option}\n`;
    });

    description += `\n⏱️ **Tempo:** ${timeRemaining}s\n`;
    description += `📚 **Período:** ${currentQuestion.category}\n`;
    description += `⭐ **Dificuldade:** ${currentQuestion.difficulty}`;

    const answeredPlayers = this.session.players.filter(
      (p) => data.answered[p.userId],
    );
    if (answeredPlayers.length > 0) {
      description += `\n\n✅ **Responderam:** ${answeredPlayers.map((p) => p.username).join(', ')}`;
    }

    const difficultyColors = {
      easy: 0x00ff00,
      medium: 0xffaa00,
      hard: 0xff0000,
    };
    const color =
      difficultyColors[
        currentQuestion.difficulty as keyof typeof difficultyColors
      ] || 0x3498db;

    return GameUtils.createGameEmbed(
      '🇧🇷 História do Brasil',
      description,
      color,
    );
  }

  private getResultsEmbed(): EmbedBuilder {
    const data = this.session.data as BrazilHistoryData;
    const sortedPlayers = this.session.players.sort(
      (a, b) => (data.scores[b.userId] || 0) - (data.scores[a.userId] || 0),
    );

    let description = '🎉 **Resultados Finais!**\n\n';

    sortedPlayers.forEach((player, index) => {
      const position = index + 1;
      const score = data.scores[player.userId] || 0;
      const medal = GameUtils.getPositionMedal(position);
      description += `${medal} **${player.username}** - ${score} pontos\n`;
    });

    description += '\n📚 **Conhecimento Histórico Testado!**\n';
    description += `• Total de perguntas: ${data.questions.length}\n`;
    description += `• Tempo por pergunta: ${data.timeLimit}s`;

    return GameUtils.createGameEmbed(
      '🏆 História do Brasil - Resultados',
      description,
      0x00ff00,
    );
  }

  getActionButtons() {
    const data = this.session.data as BrazilHistoryData;

    if (data.finished) return [];

    const currentQuestion = data.questions[data.currentQuestionIndex];
    if (!currentQuestion.options) return [];

    const labels = currentQuestion.options.map((_, index) =>
      String.fromCharCode(65 + index),
    );
    const customIds = labels.map((_, index) => `history_answer_${index}`);

    return [
      GameUtils.createGameButtons({
        labels,
        customIds,
        styles: labels.map(() => ButtonStyle.Primary),
      }),
    ];
  }

  async finish(): Promise<GameResult> {
    const data = this.session.data as BrazilHistoryData;
    const sortedPlayers = this.session.players.sort(
      (a, b) => (data.scores[b.userId] || 0) - (data.scores[a.userId] || 0),
    );

    const rewards: Record<string, any> = {};

    sortedPlayers.forEach((player, index) => {
      const baseRewards = this.calculateRewards(player, index + 1);
      const score = data.scores[player.userId] || 0;
      baseRewards.xp += Math.floor(score / 10);
      rewards[player.userId] = baseRewards;
    });

    return {
      sessionId: this.session.id,
      winners: sortedPlayers.length > 0 ? [sortedPlayers[0].userId] : [],
      losers: sortedPlayers.slice(1).map((p) => p.userId),
      rewards,
      stats: {
        questionsAnswered: data.questions.length,
        averageScore:
          Object.values(data.scores).reduce((a, b) => a + b, 0) /
          this.session.players.length,
        highestScore: Math.max(...Object.values(data.scores)),
        categories: [...new Set(data.questions.map((q) => q.category))],
      },
      duration: Date.now() - this.session.startedAt.getTime(),
    };
  }

  protected getBaseXpForGame(): number {
    return 15;
  }
}
