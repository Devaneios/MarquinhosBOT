import { ButtonStyle, EmbedBuilder } from 'discord.js';
import {
  BaseGame,
  GameQuestion,
  GameResult,
  GameSession,
  PlayerStatus,
} from '../core/GameTypes';
import { GameUtils } from '../core/GameUtils';

interface GeographyData {
  questions: GameQuestion[];
  currentQuestionIndex: number;
  scores: Record<string, number>;
  answered: Record<string, boolean>;
  timeLimit: number;
  questionStartTime: number;
  finished: boolean;
  hintsUsed: Record<string, number>; // total hints per player (for stats/display)
  currentHints: Record<string, number>; // hints used on the current question only
}

export class GeographyGame extends BaseGame {
  private readonly geographyQuestions: GameQuestion[] = [
    {
      id: '1',
      question: '🇧🇷 Qual é a capital do Acre?',
      options: ['Rio Branco', 'Cruzeiro do Sul', 'Sena Madureira', 'Tarauacá'],
      correctAnswer: 0,
      difficulty: 'medium',
      category: 'Brasil',
      hint: 'Nome de um famoso líder seringueiro',
      explanation: 'Rio Branco, em homenagem ao Barão do Rio Branco',
    },
    {
      id: '2',
      question: '🗻 Qual é a montanha mais alta do mundo?',
      options: ['K2', 'Monte Everest', 'Kangchenjunga', 'Lhotse'],
      correctAnswer: 1,
      difficulty: 'easy',
      category: 'Mundo',
      hint: 'Localizada entre Nepal e Tibet',
      explanation: 'Monte Everest com 8.848 metros de altitude',
    },
    {
      id: '3',
      question: '🏖️ Qual país tem mais ilhas no mundo?',
      options: ['Filipinas', 'Indonésia', 'Finlândia', 'Suécia'],
      correctAnswer: 2,
      difficulty: 'hard',
      category: 'Mundo',
      hint: 'País nórdico conhecido pelos lagos',
      explanation: 'Finlândia tem mais de 188.000 ilhas',
    },
    {
      id: '4',
      question: '🌊 Qual é o rio mais longo do Brasil?',
      options: [
        'Rio São Francisco',
        'Rio Paraná',
        'Rio Amazonas',
        'Rio Tocantins',
      ],
      correctAnswer: 2,
      difficulty: 'easy',
      category: 'Brasil',
      hint: 'Passa por vários países da América do Sul',
      explanation: 'Rio Amazonas com cerca de 6.400 km',
    },
    {
      id: '5',
      question: '🏜️ Qual é o maior deserto do mundo?',
      options: ['Saara', 'Gobi', 'Antártica', 'Kalahari'],
      correctAnswer: 2,
      difficulty: 'hard',
      category: 'Mundo',
      hint: 'É um deserto polar',
      explanation: 'Antártica é tecnicamente o maior deserto (polar)',
    },
    {
      id: '6',
      question: '🌴 Qual estado brasileiro tem mais praias?',
      options: ['Rio de Janeiro', 'Bahia', 'São Paulo', 'Ceará'],
      correctAnswer: 1,
      difficulty: 'medium',
      category: 'Brasil',
      hint: 'Tem o maior litoral do Brasil',
      explanation: 'Bahia possui mais de 1.000 km de litoral',
    },
    {
      id: '7',
      question: '🌍 Qual continente tem mais países?',
      options: ['Ásia', 'Europa', 'África', 'América'],
      correctAnswer: 2,
      difficulty: 'medium',
      category: 'Mundo',
      hint: 'Berço da humanidade',
      explanation: 'África tem 54 países reconhecidos',
    },
    {
      id: '8',
      question: '🏙️ Qual é a cidade mais populosa do Brasil?',
      options: ['Rio de Janeiro', 'São Paulo', 'Brasília', 'Salvador'],
      correctAnswer: 1,
      difficulty: 'easy',
      category: 'Brasil',
      hint: 'Centro financeiro do país',
      explanation: 'São Paulo com mais de 12 milhões de habitantes',
    },
    {
      id: '9',
      question: '❄️ Qual país tem a menor temperatura já registrada?',
      options: ['Rússia', 'Canadá', 'Antártica', 'Groenlândia'],
      correctAnswer: 2,
      difficulty: 'medium',
      category: 'Mundo',
      hint: 'Não é tecnicamente um país',
      explanation: 'Antártica registrou -89,2°C na estação Vostok',
    },
    {
      id: '10',
      question: '🏔️ Qual é a cordilheira mais longa do mundo?',
      options: ['Himalaias', 'Alpes', 'Andes', 'Rochosas'],
      correctAnswer: 2,
      difficulty: 'medium',
      category: 'Mundo',
      hint: 'Percorre toda a costa oeste da América do Sul',
      explanation: 'Cordilheira dos Andes com mais de 7.000 km',
    },
    {
      id: '11',
      question: '🌊 Qual oceano é o maior?',
      options: ['Atlântico', 'Índico', 'Pacífico', 'Ártico'],
      correctAnswer: 2,
      difficulty: 'easy',
      category: 'Mundo',
      hint: 'Nome significa "pacífico" ou "calmo"',
      explanation: 'Oceano Pacífico cobre 1/3 da superfície terrestre',
    },
    {
      id: '12',
      question: '🇧🇷 Qual região do Brasil tem mais estados?',
      options: ['Nordeste', 'Norte', 'Sudeste', 'Sul'],
      correctAnswer: 0,
      difficulty: 'medium',
      category: 'Brasil',
      hint: 'Região da caatinga e do forró',
      explanation: 'Nordeste tem 9 estados',
    },
  ];

  constructor(session: GameSession) {
    super(session);
    this.initializeGame();
  }

  private initializeGame(): void {
    const selectedQuestions = GameUtils.getRandomElements(
      this.geographyQuestions,
      6,
    );

    this.session.data = {
      questions: selectedQuestions,
      currentQuestionIndex: 0,
      scores: {},
      answered: {},
      timeLimit: 40, // 40 seconds per question
      questionStartTime: Date.now(),
      finished: false,
      hintsUsed: {},
      currentHints: {},
    } as GeographyData;

    // Initialize scores and hints
    this.session.players.forEach((player) => {
      this.session.data.scores[player.userId] = 0;
      this.session.data.hintsUsed[player.userId] = 0;
      this.session.data.currentHints[player.userId] = 0;
    });
  }

  async start(): Promise<void> {
    this.session.players.forEach((p) => (p.status = PlayerStatus.ACTIVE));
    this.session.data.questionStartTime = Date.now();
  }

  async handlePlayerAction(userId: string, action: any): Promise<void> {
    const data = this.session.data as GeographyData;

    if (data.finished) return;

    switch (action.type) {
      case 'answer':
        if (!data.answered[userId]) {
          await this.submitAnswer(userId, action.answer);
        }
        break;
      case 'hint':
        await this.showHint(userId);
        break;
    }
  }

  private async submitAnswer(userId: string, answer: number): Promise<void> {
    const data = this.session.data as GeographyData;
    const currentQuestion = data.questions[data.currentQuestionIndex];

    data.answered[userId] = true;

    const isCorrect = answer === currentQuestion.correctAnswer;
    if (isCorrect) {
      const timeBonus = this.calculateTimeBonus();
      const difficultyBonus = this.getDifficultyBonus(
        currentQuestion.difficulty,
      );
      const hintPenalty = (data.currentHints[userId] || 0) * 10; // 10 points penalty per hint used on this question
      const points = Math.max(
        50,
        100 + timeBonus + difficultyBonus - hintPenalty,
      );

      data.scores[userId] += points;
      this.updatePlayerScore(userId, data.scores[userId]);
    }

    // Check if all players answered or time's up
    const allAnswered = this.session.players.every(
      (p) => data.answered[p.userId],
    );
    const timeUp = Date.now() - data.questionStartTime > data.timeLimit * 1000;

    if (allAnswered || timeUp) {
      await this.nextQuestion();
    }
  }

  private async showHint(userId: string): Promise<void> {
    const data = this.session.data as GeographyData;
    data.hintsUsed[userId] = (data.hintsUsed[userId] || 0) + 1;
    data.currentHints[userId] = (data.currentHints[userId] || 0) + 1;
  }

  private calculateTimeBonus(): number {
    const data = this.session.data as GeographyData;
    const elapsed = Date.now() - data.questionStartTime;
    const remaining = Math.max(0, data.timeLimit * 1000 - elapsed);
    return Math.floor((remaining / (data.timeLimit * 1000)) * 60); // Max 60 bonus points
  }

  private getDifficultyBonus(difficulty: string): number {
    switch (difficulty) {
      case 'easy':
        return 0;
      case 'medium':
        return 30;
      case 'hard':
        return 60;
      default:
        return 0;
    }
  }

  private async nextQuestion(): Promise<void> {
    const data = this.session.data as GeographyData;

    data.currentQuestionIndex++;
    data.answered = {};
    data.currentHints = {}; // reset per-question hints so the penalty doesn't carry over
    data.questionStartTime = Date.now();

    if (data.currentQuestionIndex >= data.questions.length) {
      data.finished = true;
    }
  }

  getGameEmbed(): EmbedBuilder {
    const data = this.session.data as GeographyData;

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
      const letter = String.fromCharCode(65 + index); // A, B, C, D
      description += `**${letter})** ${option}\n`;
    });

    description += `\n⏱️ **Tempo restante:** ${timeRemaining}s\n`;
    description += `🌍 **Categoria:** ${currentQuestion.category}\n`;
    description += `⭐ **Dificuldade:** ${currentQuestion.difficulty}`;

    // Show hint if available and requested
    const hintRequested = this.session.players.some(
      (p) =>
        this.session.data.hintsUsed[p.userId] > 0 &&
        data.currentQuestionIndex < data.questions.length,
    );

    if (hintRequested && currentQuestion.hint) {
      description += `\n\n💡 **Dica:** ${currentQuestion.hint}`;
    }

    // Show who answered
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

    return GameUtils.createGameEmbed('🌍 Geografia Maluca', description, color);
  }

  private getResultsEmbed(): EmbedBuilder {
    const data = this.session.data as GeographyData;
    const sortedPlayers = this.session.players.sort(
      (a, b) => (data.scores[b.userId] || 0) - (data.scores[a.userId] || 0),
    );

    let description = '🎉 **Resultados Finais!**\n\n';

    sortedPlayers.forEach((player, index) => {
      const position = index + 1;
      const score = data.scores[player.userId] || 0;
      const hints = data.hintsUsed[player.userId] || 0;
      const medal = GameUtils.getPositionMedal(position);
      description += `${medal} **${player.username}** - ${score} pontos`;
      if (hints > 0) {
        description += ` (${hints} dicas usadas)`;
      }
      description += '\n';
    });

    description += '\n🗺️ **Estatísticas:**\n';
    description += `• Total de perguntas: ${data.questions.length}\n`;
    description += `• Tempo por pergunta: ${data.timeLimit}s\n`;

    const avgScore =
      Object.values(data.scores).reduce((a, b) => a + b, 0) /
      this.session.players.length;
    const totalHints = Object.values(data.hintsUsed).reduce((a, b) => a + b, 0);
    description += `• Pontuação média: ${Math.round(avgScore)}\n`;
    description += `• Total de dicas usadas: ${totalHints}`;

    return GameUtils.createGameEmbed(
      '🏆 Geografia Maluca - Resultados',
      description,
      0x00ff00,
    );
  }

  getActionButtons() {
    const data = this.session.data as GeographyData;

    if (data.finished) return [];

    const currentQuestion = data.questions[data.currentQuestionIndex];
    if (!currentQuestion.options) return [];

    const answerButtons = [];
    const labels = currentQuestion.options.map((_, index) =>
      String.fromCharCode(65 + index),
    );
    const customIds = labels.map((_, index) => `geo_answer_${index}`);

    answerButtons.push(
      GameUtils.createGameButtons({
        labels,
        customIds,
        styles: labels.map(() => ButtonStyle.Primary),
      }),
    );

    // Hint button
    if (currentQuestion.hint) {
      answerButtons.push(
        GameUtils.createGameButtons({
          labels: ['💡 Dica (-10 pontos)'],
          customIds: ['geo_hint'],
          styles: [ButtonStyle.Secondary],
        }),
      );
    }

    return answerButtons;
  }

  async finish(): Promise<GameResult> {
    const data = this.session.data as GeographyData;
    const sortedPlayers = this.session.players.sort(
      (a, b) => (data.scores[b.userId] || 0) - (data.scores[a.userId] || 0),
    );

    const rewards: Record<string, any> = {};

    sortedPlayers.forEach((player, index) => {
      const baseRewards = this.calculateRewards(player, index + 1);
      const score = data.scores[player.userId] || 0;
      const hintsUsed = data.hintsUsed[player.userId] || 0;

      // Bonus XP based on performance
      baseRewards.xp += Math.floor(score / 8);

      // Penalty for using too many hints
      if (hintsUsed > 2) {
        baseRewards.xp = Math.max(5, baseRewards.xp - (hintsUsed - 2) * 5);
      }

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
        totalHintsUsed: Object.values(data.hintsUsed).reduce(
          (a, b) => a + b,
          0,
        ),
        categories: [...new Set(data.questions.map((q) => q.category))],
      },
      duration: Date.now() - this.session.startedAt.getTime(),
    };
  }

  protected getBaseXpForGame(): number {
    return 12;
  }
}
