import { EmbedBuilder, ButtonStyle } from 'discord.js';
import { BaseGame, GameSession, GameResult, PlayerStatus } from '../core/GameTypes';
import { GameUtils } from '../core/GameUtils';

interface TranslateData {
  phrases: TranslatePhrase[];
  currentIndex: number;
  scores: Record<string, number>;
  answered: Record<string, boolean>;
  timeLimit: number;
  questionStartTime: number;
  finished: boolean;
}

interface TranslatePhrase {
  original: string;
  translation: string;
  fromLang: string;
  toLang: string;
  difficulty: 'easy' | 'medium' | 'hard';
  hint?: string;
}

export class TranslateGame extends BaseGame {
  private readonly phrases: TranslatePhrase[] = [
    // English to Portuguese
    { original: 'Hello World', translation: 'OLÁ MUNDO', fromLang: '🇺🇸', toLang: '🇧🇷', difficulty: 'easy' },
    { original: 'Good Morning', translation: 'BOM DIA', fromLang: '🇺🇸', toLang: '🇧🇷', difficulty: 'easy' },
    { original: 'Thank You', translation: 'OBRIGADO', fromLang: '🇺🇸', toLang: '🇧🇷', difficulty: 'easy' },
    { original: 'I Love You', translation: 'EU TE AMO', fromLang: '🇺🇸', toLang: '🇧🇷', difficulty: 'medium' },
    
    // Spanish to Portuguese
    { original: 'Hola Amigo', translation: 'OLÁ AMIGO', fromLang: '🇪🇸', toLang: '🇧🇷', difficulty: 'easy' },
    { original: 'Hasta Luego', translation: 'ATÉ LOGO', fromLang: '🇪🇸', toLang: '🇧🇷', difficulty: 'medium' },
    
    // Portuguese to English
    { original: 'Como Vai', translation: 'HOW ARE YOU', fromLang: '🇧🇷', toLang: '🇺🇸', difficulty: 'medium' },
    { original: 'Muito Obrigado', translation: 'THANK YOU VERY MUCH', fromLang: '🇧🇷', toLang: '🇺🇸', difficulty: 'hard' }
  ];

  constructor(session: GameSession) {
    super(session);
    this.initializeGame();
  }

  private initializeGame(): void {
    const selectedPhrases = GameUtils.getRandomElements(this.phrases, 4);
    
    this.session.data = {
      phrases: selectedPhrases,
      currentIndex: 0,
      scores: {},
      answered: {},
      timeLimit: 45,
      questionStartTime: Date.now(),
      finished: false
    } as TranslateData;

    this.session.players.forEach(player => {
      this.session.data.scores[player.userId] = 0;
    });
  }

  async start(): Promise<void> {
    this.session.players.forEach(p => p.status = PlayerStatus.ACTIVE);
    this.session.data.questionStartTime = Date.now();
  }

  async handlePlayerAction(userId: string, action: any): Promise<void> {
    const data = this.session.data as TranslateData;
    
    if (data.finished || data.answered[userId]) return;

    if (action.type === 'translate') {
      await this.submitTranslation(userId, action.translation);
    }
  }

  private async submitTranslation(userId: string, translation: string): Promise<void> {
    const data = this.session.data as TranslateData;
    const currentPhrase = data.phrases[data.currentIndex];
    
    data.answered[userId] = true;
    
    translation = translation.toUpperCase().trim();
    
    if (translation === currentPhrase.translation) {
      const timeBonus = this.calculateTimeBonus();
      const difficultyBonus = this.getDifficultyBonus(currentPhrase.difficulty);
      const points = 100 + timeBonus + difficultyBonus;
      
      data.scores[userId] += points;
      this.updatePlayerScore(userId, data.scores[userId]);
    }

    const allAnswered = this.session.players.every(p => data.answered[p.userId]);
    const timeUp = Date.now() - data.questionStartTime > data.timeLimit * 1000;
    
    if (allAnswered || timeUp) {
      await this.nextPhrase();
    }
  }

  private calculateTimeBonus(): number {
    const data = this.session.data as TranslateData;
    const elapsed = Date.now() - data.questionStartTime;
    const remaining = Math.max(0, data.timeLimit * 1000 - elapsed);
    return Math.floor((remaining / (data.timeLimit * 1000)) * 30);
  }

  private getDifficultyBonus(difficulty: string): number {
    switch (difficulty) {
      case 'easy': return 0;
      case 'medium': return 20;
      case 'hard': return 40;
      default: return 0;
    }
  }

  private async nextPhrase(): Promise<void> {
    const data = this.session.data as TranslateData;
    
    data.currentIndex++;
    data.answered = {};
    data.questionStartTime = Date.now();

    if (data.currentIndex >= data.phrases.length) {
      data.finished = true;
    }
  }

  getGameEmbed(): EmbedBuilder {
    const data = this.session.data as TranslateData;
    
    if (data.finished) {
      return this.getResultsEmbed();
    }

    const currentPhrase = data.phrases[data.currentIndex];
    const timeRemaining = Math.max(0, data.timeLimit - Math.floor((Date.now() - data.questionStartTime) / 1000));
    
    let description = `**Tradução ${data.currentIndex + 1}/${data.phrases.length}**\n\n`;
    description += `**Traduza:** ${currentPhrase.original}\n`;
    description += `**De:** ${currentPhrase.fromLang} **Para:** ${currentPhrase.toLang}\n`;
    description += `**Dificuldade:** ${currentPhrase.difficulty}\n`;
    description += `⏱️ **Tempo:** ${timeRemaining}s\n`;

    if (currentPhrase.hint) {
      description += `💡 **Dica:** ${currentPhrase.hint}\n`;
    }

    const answeredPlayers = this.session.players.filter(p => data.answered[p.userId]);
    if (answeredPlayers.length > 0) {
      description += `\n✅ **Responderam:** ${answeredPlayers.map(p => p.username).join(', ')}`;
    }

    return GameUtils.createGameEmbed('🌐 Traduzindo', description, 0x3498db);
  }

  private getResultsEmbed(): EmbedBuilder {
    const data = this.session.data as TranslateData;
    const sortedPlayers = this.session.players.sort((a, b) => 
      (data.scores[b.userId] || 0) - (data.scores[a.userId] || 0)
    );

    let description = '🎉 **Resultados Finais!**\n\n';
    
    sortedPlayers.forEach((player, index) => {
      const position = index + 1;
      const score = data.scores[player.userId] || 0;
      const medal = GameUtils.getPositionMedal(position);
      description += `${medal} **${player.username}** - ${score} pontos\n`;
    });

    return GameUtils.createGameEmbed('🏆 Traduzindo - Resultados', description, 0x00ff00);
  }

  async finish(): Promise<GameResult> {
    const data = this.session.data as TranslateData;
    const sortedPlayers = this.session.players.sort((a, b) => 
      (data.scores[b.userId] || 0) - (data.scores[a.userId] || 0)
    );

    const winners = sortedPlayers.slice(0, Math.min(3, sortedPlayers.length));
    const rewards: Record<string, any> = {};

    sortedPlayers.forEach((player, index) => {
      const baseRewards = this.calculateRewards(player, index + 1);
      const score = data.scores[player.userId] || 0;
      baseRewards.xp += Math.floor(score / 8);
      rewards[player.userId] = baseRewards;
    });

    return {
      sessionId: this.session.id,
      winners: winners.map(p => p.userId),
      losers: [],
      rewards,
      stats: {
        phrasesTranslated: data.phrases.length,
        averageScore: Object.values(data.scores).reduce((a, b) => a + b, 0) / this.session.players.length,
        highestScore: Math.max(...Object.values(data.scores))
      },
      duration: Date.now() - this.session.startedAt.getTime()
    };
  }

  protected getBaseXpForGame(): number {
    return 12;
  }
}
