import { EmbedBuilder, ButtonStyle } from 'discord.js';
import {
  BaseGame,
  GameSession,
  GameResult,
  PlayerStatus,
  GameQuestion,
} from '../core/GameTypes';
import { GameUtils } from '../core/GameUtils';

interface PopCultureData {
  questions: GameQuestion[];
  currentQuestionIndex: number;
  scores: Record<string, number>;
  answered: Record<string, boolean>;
  timeLimit: number;
  questionStartTime: number;
  finished: boolean;
}

export class PopCultureGame extends BaseGame {
  private readonly popQuestions: GameQuestion[] = [
    {
      id: '1',
      question: '🎬 Qual filme ganhou o Oscar de Melhor Filme em 2020?',
      options: ['1917', 'Parasita', 'Joker', 'Era uma vez em Hollywood'],
      correctAnswer: 1,
      difficulty: 'medium',
      category: 'Cinema',
    },
    {
      id: '2',
      question: '📺 Em "Breaking Bad", qual é o nome verdadeiro do Heisenberg?',
      options: [
        'Jesse Pinkman',
        'Walter White',
        'Saul Goodman',
        'Hank Schrader',
      ],
      correctAnswer: 1,
      difficulty: 'easy',
      category: 'Séries',
    },
    {
      id: '3',
      question: '🎮 Qual empresa criou o jogo "Minecraft"?',
      options: ['Microsoft', 'Mojang', 'Electronic Arts', 'Activision'],
      correctAnswer: 1,
      difficulty: 'medium',
      category: 'Games',
    },
    {
      id: '4',
      question: '🎵 Qual cantora lançou o álbum "Folklore" em 2020?',
      options: ['Ariana Grande', 'Taylor Swift', 'Billie Eilish', 'Dua Lipa'],
      correctAnswer: 1,
      difficulty: 'easy',
      category: 'Música',
    },
    {
      id: '5',
      question: '🦸 Qual é o nome verdadeiro do Batman?',
      options: ['Clark Kent', 'Peter Parker', 'Bruce Wayne', 'Tony Stark'],
      correctAnswer: 2,
      difficulty: 'easy',
      category: 'Quadrinhos',
    },
    {
      id: '6',
      question: '📱 Em que ano foi lançado o primeiro iPhone?',
      options: ['2006', '2007', '2008', '2009'],
      correctAnswer: 1,
      difficulty: 'medium',
      category: 'Tecnologia',
    },
    {
      id: '7',
      question: '🎭 Qual ator interpretou Jack Sparrow em "Piratas do Caribe"?',
      options: [
        'Orlando Bloom',
        'Johnny Depp',
        'Geoffrey Rush',
        'Keira Knightley',
      ],
      correctAnswer: 1,
      difficulty: 'easy',
      category: 'Cinema',
    },
    {
      id: '8',
      question: '🎪 Qual reality show brasileiro mais famoso da TV Globo?',
      options: [
        'Big Brother Brasil',
        'The Voice',
        'Dança dos Famosos',
        'Caldeirão',
      ],
      correctAnswer: 0,
      difficulty: 'easy',
      category: 'TV Brasileira',
    },
    {
      id: '9',
      question: '🕷️ Qual ator interpretou o Homem-Aranha no MCU?',
      options: [
        'Tobey Maguire',
        'Andrew Garfield',
        'Tom Holland',
        'Miles Morales',
      ],
      correctAnswer: 2,
      difficulty: 'medium',
      category: 'Cinema',
    },
    {
      id: '10',
      question: '📚 Qual saga de livros foi adaptada em "Game of Thrones"?',
      options: [
        'O Senhor dos Anéis',
        'As Crônicas de Gelo e Fogo',
        'Harry Potter',
        'Crepúsculo',
      ],
      correctAnswer: 1,
      difficulty: 'medium',
      category: 'Literatura',
    },
  ];

  constructor(session: GameSession) {
    super(session);
    this.initializeGame();
  }

  private initializeGame(): void {
    const selectedQuestions = GameUtils.getRandomElements(this.popQuestions, 5);

    this.session.data = {
      questions: selectedQuestions,
      currentQuestionIndex: 0,
      scores: {},
      answered: {},
      timeLimit: 30,
      questionStartTime: Date.now(),
      finished: false,
    } as PopCultureData;

    this.session.players.forEach((player) => {
      this.session.data.scores[player.userId] = 0;
    });
  }

  async start(): Promise<void> {
    this.session.players.forEach((p) => (p.status = PlayerStatus.ACTIVE));
    this.session.data.questionStartTime = Date.now();
  }

  async handlePlayerAction(userId: string, action: any): Promise<void> {
    const data = this.session.data as PopCultureData;

    if (data.finished || data.answered[userId]) return;

    if (action.type === 'answer') {
      await this.submitAnswer(userId, action.answer);
    }
  }

  private async submitAnswer(userId: string, answer: number): Promise<void> {
    const data = this.session.data as PopCultureData;
    const currentQuestion = data.questions[data.currentQuestionIndex];

    data.answered[userId] = true;

    if (answer === currentQuestion.correctAnswer) {
      const timeBonus = this.calculateTimeBonus();
      const points = 100 + timeBonus;
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
    const data = this.session.data as PopCultureData;
    const elapsed = Date.now() - data.questionStartTime;
    const remaining = Math.max(0, data.timeLimit * 1000 - elapsed);
    return Math.floor((remaining / (data.timeLimit * 1000)) * 40);
  }

  private async nextQuestion(): Promise<void> {
    const data = this.session.data as PopCultureData;

    data.currentQuestionIndex++;
    data.answered = {};
    data.questionStartTime = Date.now();

    if (data.currentQuestionIndex >= data.questions.length) {
      data.finished = true;
    }
  }

  getGameEmbed(): EmbedBuilder {
    const data = this.session.data as PopCultureData;

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
    description += `📺 **Categoria:** ${currentQuestion.category}`;

    const answeredPlayers = this.session.players.filter(
      (p) => data.answered[p.userId],
    );
    if (answeredPlayers.length > 0) {
      description += `\n\n✅ **Responderam:** ${answeredPlayers.map((p) => p.username).join(', ')}`;
    }

    return GameUtils.createGameEmbed('📺 Cultura Pop', description, 0xff6b9d);
  }

  private getResultsEmbed(): EmbedBuilder {
    const data = this.session.data as PopCultureData;
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

    return GameUtils.createGameEmbed(
      '🏆 Cultura Pop - Resultados',
      description,
      0x00ff00,
    );
  }

  getActionButtons() {
    const data = this.session.data as PopCultureData;

    if (data.finished) return [];

    const currentQuestion = data.questions[data.currentQuestionIndex];
    if (!currentQuestion.options) return [];

    const labels = currentQuestion.options.map((_, index) =>
      String.fromCharCode(65 + index),
    );
    const customIds = labels.map((_, index) => `pop_answer_${index}`);

    return [
      GameUtils.createGameButtons({
        labels,
        customIds,
        styles: labels.map(() => ButtonStyle.Primary),
      }),
    ];
  }

  async finish(): Promise<GameResult> {
    const data = this.session.data as PopCultureData;
    const sortedPlayers = this.session.players.sort(
      (a, b) => (data.scores[b.userId] || 0) - (data.scores[a.userId] || 0),
    );

    const winners = sortedPlayers.slice(0, Math.min(3, sortedPlayers.length));
    const rewards: Record<string, any> = {};

    sortedPlayers.forEach((player, index) => {
      const baseRewards = this.calculateRewards(player, index + 1);
      const score = data.scores[player.userId] || 0;
      baseRewards.xp += Math.floor(score / 12);
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
