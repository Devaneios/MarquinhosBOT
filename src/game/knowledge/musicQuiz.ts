import { EmbedBuilder, ButtonStyle } from 'discord.js';
import {
  BaseGame,
  GameSession,
  GameResult,
  PlayerStatus,
  GameQuestion,
} from '../core/GameTypes';
import { GameUtils } from '../core/GameUtils';

interface MusicQuizData {
  questions: GameQuestion[];
  currentQuestionIndex: number;
  scores: Record<string, number>;
  answered: Record<string, boolean>;
  timeLimit: number;
  questionStartTime: number;
  finished: boolean;
}

export class MusicQuizGame extends BaseGame {
  private readonly musicQuestions: GameQuestion[] = [
    {
      id: '1',
      question: '🎵 Qual cantor é conhecido como "Rei do Rock"?',
      options: [
        'Elvis Presley',
        'Michael Jackson',
        'Chuck Berry',
        'Little Richard',
      ],
      correctAnswer: 0,
      difficulty: 'easy',
      category: 'Rock',
      explanation:
        'Elvis Presley é mundialmente conhecido como o "Rei do Rock"',
    },
    {
      id: '2',
      question: '🎤 Qual banda criou a música "Bohemian Rhapsody"?',
      options: ['The Beatles', 'Queen', 'Led Zeppelin', 'Pink Floyd'],
      correctAnswer: 1,
      difficulty: 'medium',
      category: 'Rock',
      explanation: 'Queen, com Freddie Mercury, criou esta obra-prima em 1975',
    },
    {
      id: '3',
      question: '🇧🇷 Quem compôs "Garota de Ipanema"?',
      options: ['Caetano Veloso', 'Tom Jobim', 'Chico Buarque', 'Gilberto Gil'],
      correctAnswer: 1,
      difficulty: 'medium',
      category: 'MPB',
      explanation:
        'Tom Jobim e Vinicius de Moraes compuseram este clássico da Bossa Nova',
    },
    {
      id: '4',
      question: '🎸 Qual instrumento Jimmy Hendrix era famoso por tocar?',
      options: ['Bateria', 'Baixo', 'Guitarra', 'Teclado'],
      correctAnswer: 2,
      difficulty: 'easy',
      category: 'Rock',
      explanation: 'Jimi Hendrix revolucionou o som da guitarra elétrica',
    },
    {
      id: '5',
      question: '🎺 Qual gênero musical Louis Armstrong ajudou a criar?',
      options: ['Blues', 'Jazz', 'Soul', 'Funk'],
      correctAnswer: 1,
      difficulty: 'medium',
      category: 'Jazz',
      explanation: 'Louis Armstrong foi fundamental no desenvolvimento do Jazz',
    },
    {
      id: '6',
      question: '🎵 Qual banda brasileira cantava "Pais e Filhos"?',
      options: ['Legião Urbana', 'Titãs', 'Paralamas', 'Barão Vermelho'],
      correctAnswer: 0,
      difficulty: 'easy',
      category: 'Rock Nacional',
      explanation: 'Legião Urbana, de Renato Russo, é autora deste clássico',
    },
    {
      id: '7',
      question: '🎹 Qual compositor criou "Für Elise"?',
      options: ['Mozart', 'Bach', 'Beethoven', 'Chopin'],
      correctAnswer: 2,
      difficulty: 'medium',
      category: 'Clássica',
      explanation: 'Ludwig van Beethoven compôs esta peça famosa para piano',
    },
    {
      id: '8',
      question: '🎤 Qual cantora é conhecida como "Rainha do Pop"?',
      options: ['Whitney Houston', 'Madonna', 'Janet Jackson', 'Mariah Carey'],
      correctAnswer: 1,
      difficulty: 'easy',
      category: 'Pop',
      explanation: 'Madonna é amplamente reconhecida como a "Rainha do Pop"',
    },
    {
      id: '9',
      question: '🥁 Phil Collins foi baterista de qual banda?',
      options: ['The Police', 'Genesis', 'Yes', 'King Crimson'],
      correctAnswer: 1,
      difficulty: 'hard',
      category: 'Rock Progressivo',
      explanation: 'Phil Collins foi baterista e depois vocalista do Genesis',
    },
    {
      id: '10',
      question: '🎵 "Imagine" é uma música de qual artista?',
      options: [
        'Paul McCartney',
        'John Lennon',
        'George Harrison',
        'Ringo Starr',
      ],
      correctAnswer: 1,
      difficulty: 'easy',
      category: 'Rock',
      explanation: 'John Lennon escreveu e gravou "Imagine" em 1971',
    },
    {
      id: '11',
      question: '🇧🇷 Qual banda tocava "Será que vai chover"?',
      options: ['Fernanda Abreu', 'Lulu Santos', 'Fernanda Takai', 'Pato Fu'],
      correctAnswer: 3,
      difficulty: 'hard',
      category: 'Rock Nacional',
      explanation: 'Pato Fu é a banda autora desta música',
    },
    {
      id: '12',
      question: '🎸 Qual banda criou "Stairway to Heaven"?',
      options: ['Deep Purple', 'Led Zeppelin', 'Black Sabbath', 'The Who'],
      correctAnswer: 1,
      difficulty: 'medium',
      category: 'Rock',
      explanation: 'Led Zeppelin criou este épico do rock em 1971',
    },
  ];

  constructor(session: GameSession) {
    super(session);
    this.initializeGame();
  }

  private initializeGame(): void {
    const selectedQuestions = GameUtils.getRandomElements(
      this.musicQuestions,
      5,
    );

    this.session.data = {
      questions: selectedQuestions,
      currentQuestionIndex: 0,
      scores: {},
      answered: {},
      timeLimit: 30, // 30 seconds per question
      questionStartTime: Date.now(),
      finished: false,
    } as MusicQuizData;

    // Initialize scores
    this.session.players.forEach((player) => {
      this.session.data.scores[player.userId] = 0;
    });
  }

  async start(): Promise<void> {
    this.session.players.forEach((p) => (p.status = PlayerStatus.ACTIVE));
    this.session.data.questionStartTime = Date.now();
  }

  async handlePlayerAction(userId: string, action: any): Promise<void> {
    const data = this.session.data as MusicQuizData;

    if (data.finished || data.answered[userId]) return;

    if (action.type === 'answer') {
      await this.submitAnswer(userId, action.answer);
    }
  }

  private async submitAnswer(userId: string, answer: number): Promise<void> {
    const data = this.session.data as MusicQuizData;
    const currentQuestion = data.questions[data.currentQuestionIndex];

    data.answered[userId] = true;

    const isCorrect = answer === currentQuestion.correctAnswer;
    if (isCorrect) {
      const timeBonus = this.calculateTimeBonus();
      const difficultyBonus = this.getDifficultyBonus(
        currentQuestion.difficulty,
      );
      const points = 100 + timeBonus + difficultyBonus;

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

  private calculateTimeBonus(): number {
    const data = this.session.data as MusicQuizData;
    const elapsed = Date.now() - data.questionStartTime;
    const remaining = Math.max(0, data.timeLimit * 1000 - elapsed);
    return Math.floor((remaining / (data.timeLimit * 1000)) * 50); // Max 50 bonus points
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
    const data = this.session.data as MusicQuizData;

    data.currentQuestionIndex++;
    data.answered = {};
    data.questionStartTime = Date.now();

    if (data.currentQuestionIndex >= data.questions.length) {
      data.finished = true;
    }
  }

  getGameEmbed(): EmbedBuilder {
    const data = this.session.data as MusicQuizData;

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
    description += `🎯 **Categoria:** ${currentQuestion.category}\n`;
    description += `⭐ **Dificuldade:** ${currentQuestion.difficulty}`;

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

    return GameUtils.createGameEmbed('🎵 Quiz Musical', description, color);
  }

  private getResultsEmbed(): EmbedBuilder {
    const data = this.session.data as MusicQuizData;
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

    description += '\n📊 **Estatísticas:**\n';
    description += `• Total de perguntas: ${data.questions.length}\n`;
    description += `• Tempo por pergunta: ${data.timeLimit}s\n`;

    const avgScore =
      Object.values(data.scores).reduce((a, b) => a + b, 0) /
      this.session.players.length;
    description += `• Pontuação média: ${Math.round(avgScore)}`;

    return GameUtils.createGameEmbed(
      '🏆 Quiz Musical - Resultados',
      description,
      0x00ff00,
    );
  }

  getAnswerButtons() {
    const data = this.session.data as MusicQuizData;

    if (data.finished) return [];

    const currentQuestion = data.questions[data.currentQuestionIndex];
    if (!currentQuestion.options) return [];

    const labels = currentQuestion.options.map((_, index) =>
      String.fromCharCode(65 + index),
    );
    const customIds = labels.map((_, index) => `quiz_answer_${index}`);

    return [
      GameUtils.createGameButtons({
        labels,
        customIds,
        styles: labels.map(() => ButtonStyle.Primary),
      }),
    ];
  }

  async finish(): Promise<GameResult> {
    const data = this.session.data as MusicQuizData;
    const sortedPlayers = this.session.players.sort(
      (a, b) => (data.scores[b.userId] || 0) - (data.scores[a.userId] || 0),
    );

    const winners = sortedPlayers.slice(0, Math.min(3, sortedPlayers.length));
    const rewards: Record<string, any> = {};

    sortedPlayers.forEach((player, index) => {
      const baseRewards = this.calculateRewards(player, index + 1);
      const score = data.scores[player.userId] || 0;

      // Bonus XP based on performance
      baseRewards.xp += Math.floor(score / 10);

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
        categories: [...new Set(data.questions.map((q) => q.category))],
      },
      duration: Date.now() - this.session.startedAt.getTime(),
    };
  }

  protected getBaseXpForGame(): number {
    return 15;
  }
}
