import { EmbedBuilder, ButtonStyle } from 'discord.js';
import { BaseGame, GameSession, GameResult, PlayerStatus } from '../core/GameTypes';
import { GameUtils } from '../core/GameUtils';

interface AnagramData {
  originalWord: string;
  scrambledWord: string;
  category: string;
  guesses: Record<string, string[]>;
  solved: boolean;
  winner: string | null;
  timeLimit: number;
  startTime: number;
  hints: string[];
  hintsUsed: number;
}

export class AnagramGame extends BaseGame {
  private readonly anagramWords = [
    { word: 'AMOR', category: 'Sentimentos', hints: ['4 letras', 'Sentimento'] },
    { word: 'CASA', category: 'Objetos', hints: ['4 letras', 'Onde você mora'] },
    { word: 'ESTUDAR', category: 'Ações', hints: ['7 letras', 'Aprender'] },
    { word: 'CHOCOLATE', category: 'Comida', hints: ['9 letras', 'Doce'] },
    { word: 'COMPUTADOR', category: 'Tecnologia', hints: ['10 letras', 'Máquina'] },
    { word: 'PROGRAMA', category: 'Tecnologia', hints: ['8 letras', 'Software'] },
    { word: 'GUITARRA', category: 'Música', hints: ['8 letras', 'Instrumento'] },
    { word: 'ELEFANTE', category: 'Animais', hints: ['8 letras', 'Mamífero grande'] }
  ];

  constructor(session: GameSession) {
    super(session);
    this.initializeGame();
  }

  private initializeGame(): void {
    const selectedWord = GameUtils.getRandomElement(this.anagramWords);
    const scrambled = this.scrambleWord(selectedWord.word);
    
    this.session.data = {
      originalWord: selectedWord.word,
      scrambledWord: scrambled,
      category: selectedWord.category,
      guesses: {},
      solved: false,
      winner: null,
      timeLimit: 120, // 2 minutes
      startTime: Date.now(),
      hints: selectedWord.hints,
      hintsUsed: 0
    } as AnagramData;

    this.session.players.forEach(player => {
      this.session.data.guesses[player.userId] = [];
    });
  }

  private scrambleWord(word: string): string {
    const letters = word.split('');
    return GameUtils.shuffleArray(letters).join('');
  }

  async start(): Promise<void> {
    this.session.players.forEach(p => p.status = PlayerStatus.ACTIVE);
  }

  async handlePlayerAction(userId: string, action: any): Promise<void> {
    const data = this.session.data as AnagramData;
    
    if (data.solved || this.isTimeUp()) return;

    switch (action.type) {
      case 'guess':
        await this.submitGuess(userId, action.word);
        break;
      case 'hint':
        this.useHint();
        break;
    }
  }

  private async submitGuess(userId: string, guess: string): Promise<void> {
    const data = this.session.data as AnagramData;
    
    guess = guess.toUpperCase().trim();
    
    if (!guess || data.guesses[userId].includes(guess)) return;
    
    data.guesses[userId].push(guess);
    
    if (guess === data.originalWord) {
      data.solved = true;
      data.winner = userId;
      await this.updateScores();
    }
  }

  private useHint(): void {
    const data = this.session.data as AnagramData;
    data.hintsUsed++;
  }

  private isTimeUp(): boolean {
    const data = this.session.data as AnagramData;
    return Date.now() - data.startTime > data.timeLimit * 1000;
  }

  private async updateScores(): Promise<void> {
    const data = this.session.data as AnagramData;
    
    if (data.winner) {
      const timeBonus = this.calculateTimeBonus();
      const lengthBonus = data.originalWord.length * 5;
      const hintPenalty = data.hintsUsed * 10;
      const score = Math.max(50, 100 + timeBonus + lengthBonus - hintPenalty);
      
      this.updatePlayerScore(data.winner, score);
    }
  }

  private calculateTimeBonus(): number {
    const data = this.session.data as AnagramData;
    const elapsed = Date.now() - data.startTime;
    const remaining = Math.max(0, data.timeLimit * 1000 - elapsed);
    return Math.floor((remaining / (data.timeLimit * 1000)) * 50);
  }

  getGameEmbed(): EmbedBuilder {
    const data = this.session.data as AnagramData;
    const timeRemaining = Math.max(0, data.timeLimit - Math.floor((Date.now() - data.startTime) / 1000));
    
    let description = '';
    
    if (data.solved) {
      const winner = this.session.players.find(p => p.userId === data.winner);
      description += `🎉 **${winner?.username} descobriu a palavra!**\n\n`;
      description += `**Palavra:** ${data.originalWord}\n`;
    } else if (this.isTimeUp()) {
      description += `⏰ **Tempo esgotado!**\n\n`;
      description += `**A palavra era:** ${data.originalWord}\n`;
    } else {
      description += `🔀 **Descubra a palavra embaralhada!**\n\n`;
    }
    
    description += `**Anagrama:** ${data.scrambledWord}\n`;
    description += `**Categoria:** ${data.category}\n`;
    description += `**Letras:** ${data.originalWord.length}\n`;
    
    if (!data.solved && !this.isTimeUp()) {
      description += `⏱️ **Tempo restante:** ${timeRemaining}s\n`;
    }
    
    // Show hints if used
    if (data.hintsUsed > 0) {
      description += `\n💡 **Dicas:**\n`;
      for (let i = 0; i < Math.min(data.hintsUsed, data.hints.length); i++) {
        description += `• ${data.hints[i]}\n`;
      }
    }
    
    // Show recent guesses
    const recentGuesses = Object.entries(data.guesses)
      .filter(([_, guesses]) => guesses.length > 0)
      .map(([userId, guesses]) => {
        const player = this.session.players.find(p => p.userId === userId);
        return `${player?.username}: ${guesses.slice(-2).join(', ')}`;
      });
    
    if (recentGuesses.length > 0) {
      description += `\n📝 **Tentativas recentes:**\n${recentGuesses.join('\n')}`;
    }

    const color = data.solved ? 0x00ff00 : this.isTimeUp() ? 0xff0000 : 0x3498db;
    
    return GameUtils.createGameEmbed('🔀 Anagrama Insano', description, color);
  }

  getActionButtons() {
    const data = this.session.data as AnagramData;
    
    if (data.solved || this.isTimeUp()) return [];

    const buttons = [];
    
    // Hint button
    if (data.hintsUsed < data.hints.length) {
      buttons.push(
        GameUtils.createGameButtons({
          labels: ['💡 Dica (-10 pontos)'],
          customIds: ['anagram_hint'],
          styles: [ButtonStyle.Secondary]
        })
      );
    }

    return buttons;
  }

  async finish(): Promise<GameResult> {
    const data = this.session.data as AnagramData;
    const rewards: Record<string, any> = {};

    this.session.players.forEach((player, index) => {
      const isWinner = player.userId === data.winner;
      const baseRewards = this.calculateRewards(player, isWinner ? 1 : this.session.players.length);
      
      if (isWinner) {
        baseRewards.xp += 15;
      }
      
      rewards[player.userId] = baseRewards;
    });

    return {
      sessionId: this.session.id,
      winners: data.winner ? [data.winner] : [],
      losers: data.winner ? this.session.players.filter(p => p.userId !== data.winner).map(p => p.userId) : this.session.players.map(p => p.userId),
      rewards,
      stats: {
        originalWord: data.originalWord,
        solved: data.solved,
        timeUsed: Date.now() - data.startTime,
        hintsUsed: data.hintsUsed,
        totalGuesses: Object.values(data.guesses).flat().length
      },
      duration: Date.now() - this.session.startedAt.getTime()
    };
  }

  protected getBaseXpForGame(): number {
    return 10;
  }
}
