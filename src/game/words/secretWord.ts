import { ButtonStyle, EmbedBuilder } from 'discord.js';
import {
  BaseGame,
  GameResult,
  GameSession,
  PlayerStatus,
} from '../core/GameTypes';
import { GameUtils } from '../core/GameUtils';

interface SecretWordData {
  word: string;
  category: string;
  guessedLetters: string[];
  wrongLetters: string[];
  currentGuess: string;
  maxWrongGuesses: number;
  gameOver: boolean;
  won: boolean;
  hint?: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

interface WordData {
  word: string;
  category: string;
  hint?: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export class SecretWordGame extends BaseGame {
  private readonly words: WordData[] = [
    // Easy words
    {
      word: 'CASA',
      category: 'Objetos',
      difficulty: 'easy',
      hint: 'Onde você mora',
    },
    {
      word: 'GATO',
      category: 'Animais',
      difficulty: 'easy',
      hint: 'Animal doméstico que faz miau',
    },
    {
      word: 'ÁGUA',
      category: 'Natureza',
      difficulty: 'easy',
      hint: 'Líquido essencial para a vida',
    },
    {
      word: 'SOL',
      category: 'Natureza',
      difficulty: 'easy',
      hint: 'Estrela do nosso sistema solar',
    },
    {
      word: 'AMOR',
      category: 'Sentimentos',
      difficulty: 'easy',
      hint: 'Sentimento profundo de carinho',
    },

    // Medium words
    {
      word: 'COMPUTADOR',
      category: 'Tecnologia',
      difficulty: 'medium',
      hint: 'Máquina para processar dados',
    },
    {
      word: 'CHOCOLATE',
      category: 'Comida',
      difficulty: 'medium',
      hint: 'Doce feito com cacau',
    },
    {
      word: 'ELEFANTE',
      category: 'Animais',
      difficulty: 'medium',
      hint: 'Maior mamífero terrestre',
    },
    {
      word: 'BIBLIOTECA',
      category: 'Lugares',
      difficulty: 'medium',
      hint: 'Local com muitos livros',
    },
    {
      word: 'GUITARRA',
      category: 'Instrumentos',
      difficulty: 'medium',
      hint: 'Instrumento de cordas do rock',
    },
    {
      word: 'PROGRAMAÇÃO',
      category: 'Tecnologia',
      difficulty: 'medium',
      hint: 'Arte de criar software',
    },

    // Hard words
    {
      word: 'EXTRAORDINÁRIO',
      category: 'Adjetivos',
      difficulty: 'hard',
      hint: 'Algo fora do comum',
    },
    {
      word: 'PARALELEPÍPEDO',
      category: 'Geometria',
      difficulty: 'hard',
      hint: 'Forma geométrica 3D',
    },
    {
      word: 'INCONSTITUCIONAL',
      category: 'Jurídico',
      difficulty: 'hard',
      hint: 'Contrário à constituição',
    },
    {
      word: 'OTORRINOLARINGOLOGISTA',
      category: 'Profissões',
      difficulty: 'hard',
      hint: 'Médico especialista em ouvido, nariz e garganta',
    },
    {
      word: 'PNEUMOULTRAMICROSCOPICOSSILICOVULCANOCONIÓTICO',
      category: 'Medicina',
      difficulty: 'hard',
      hint: 'Doença pulmonar causada por inalação de partículas',
    },
  ];

  constructor(session: GameSession) {
    super(session);
    this.initializeGame();
  }

  private initializeGame(): void {
    const selectedWord = GameUtils.getRandomElement(this.words);

    this.session.data = {
      word: selectedWord.word,
      category: selectedWord.category,
      guessedLetters: [],
      wrongLetters: [],
      currentGuess: '',
      maxWrongGuesses: 6,
      gameOver: false,
      won: false,
      hint: selectedWord.hint,
      difficulty: selectedWord.difficulty,
    } as SecretWordData;
  }

  async start(): Promise<void> {
    this.session.players.forEach((p) => (p.status = PlayerStatus.ACTIVE));
  }

  async handlePlayerAction(userId: string, action: any): Promise<void> {
    const data = this.session.data as SecretWordData;

    if (data.gameOver) return;

    switch (action.type) {
      case 'guess_letter':
        await this.guessLetter(action.letter);
        break;
      case 'guess_word':
        await this.guessWord(action.word);
        break;
      case 'show_hint':
        // Hint is shown in embed when available
        break;
    }
  }

  private async guessLetter(letter: string): Promise<void> {
    const data = this.session.data as SecretWordData;

    letter = letter.toUpperCase();

    // Check if letter already guessed
    if (
      data.guessedLetters.includes(letter) ||
      data.wrongLetters.includes(letter)
    ) {
      return;
    }

    if (data.word.includes(letter)) {
      data.guessedLetters.push(letter);

      // Check if word is complete
      if (this.isWordComplete()) {
        data.won = true;
        data.gameOver = true;
        await this.updateScores();
      }
    } else {
      data.wrongLetters.push(letter);

      // Check if game over
      if (data.wrongLetters.length >= data.maxWrongGuesses) {
        data.gameOver = true;
        await this.updateScores();
      }
    }
  }

  private async guessWord(word: string): Promise<void> {
    const data = this.session.data as SecretWordData;

    word = word.toUpperCase();

    if (word === data.word) {
      data.won = true;
      data.gameOver = true;
      // Add all letters to guessed letters
      for (let i = 0; i < data.word.length; i++) {
        const letter = data.word[i];
        if (!data.guessedLetters.includes(letter)) {
          data.guessedLetters.push(letter);
        }
      }
    } else {
      // Wrong word guess counts as 2 wrong attempts
      data.wrongLetters.push(`${word}(palavra)`);
      data.wrongLetters.push(`${word}(palavra)`);

      if (data.wrongLetters.length >= data.maxWrongGuesses) {
        data.gameOver = true;
      }
    }

    await this.updateScores();
  }

  private isWordComplete(): boolean {
    const data = this.session.data as SecretWordData;

    for (let i = 0; i < data.word.length; i++) {
      const letter = data.word[i];
      if (letter !== ' ' && !data.guessedLetters.includes(letter)) {
        return false;
      }
    }
    return true;
  }

  private async updateScores(): Promise<void> {
    const data = this.session.data as SecretWordData;

    if (data.won) {
      const baseScore = this.getBaseScore();
      const difficultyBonus = this.getDifficultyBonus();
      const wrongPenalty = data.wrongLetters.length * 5;
      const score = Math.max(10, baseScore + difficultyBonus - wrongPenalty);

      // In multiplayer, give points to all players
      this.session.players.forEach((player) => {
        this.updatePlayerScore(player.userId, score);
      });
    }
  }

  private getBaseScore(): number {
    const data = this.session.data as SecretWordData;
    return data.word.length * 10;
  }

  private getDifficultyBonus(): number {
    const data = this.session.data as SecretWordData;
    switch (data.difficulty) {
      case 'easy':
        return 20;
      case 'medium':
        return 50;
      case 'hard':
        return 100;
      default:
        return 0;
    }
  }

  private getDisplayWord(): string {
    const data = this.session.data as SecretWordData;

    return data.word
      .split('')
      .map((letter) => {
        if (letter === ' ') return ' ';
        return data.guessedLetters.includes(letter) ? letter : '_';
      })
      .join(' ');
  }

  private getHangmanDrawing(): string {
    const data = this.session.data as SecretWordData;
    const wrongCount = data.wrongLetters.length;

    const stages = [
      '```\n  +---+\n  |   |\n      |\n      |\n      |\n      |\n=========\n```', // 0
      '```\n  +---+\n  |   |\n  O   |\n      |\n      |\n      |\n=========\n```', // 1
      '```\n  +---+\n  |   |\n  O   |\n  |   |\n      |\n      |\n=========\n```', // 2
      '```\n  +---+\n  |   |\n  O   |\n /|   |\n      |\n      |\n=========\n```', // 3
      '```\n  +---+\n  |   |\n  O   |\n /|\\  |\n      |\n      |\n=========\n```', // 4
      '```\n  +---+\n  |   |\n  O   |\n /|\\  |\n /    |\n      |\n=========\n```', // 5
      '```\n  +---+\n  |   |\n  O   |\n /|\\  |\n / \\  |\n      |\n=========\n```', // 6 (game over)
    ];

    return stages[Math.min(wrongCount, stages.length - 1)];
  }

  getGameEmbed(): EmbedBuilder {
    const data = this.session.data as SecretWordData;

    let description = '';

    // Game status
    if (data.gameOver) {
      if (data.won) {
        description += '🎉 **PARABÉNS! VOCÊS DESCOBRIRAM A PALAVRA!**\n\n';
      } else {
        description += '💀 **GAME OVER! A PALAVRA ERA:**\n\n';
      }
      description += `**${data.word}**\n\n`;
    } else {
      description += '🎯 **DESCUBRAM A PALAVRA SECRETA!**\n\n';
    }

    // Display word
    description += `**Palavra:** ${this.getDisplayWord()}\n`;
    description += `**Categoria:** ${data.category}\n`;
    description += `**Dificuldade:** ${data.difficulty}\n\n`;

    // Hint
    if (data.hint) {
      description += `💡 **Dica:** ${data.hint}\n\n`;
    }

    // Hangman drawing
    description += this.getHangmanDrawing();

    // Letters guessed
    if (data.guessedLetters.length > 0) {
      description += `✅ **Letras certas:** ${data.guessedLetters.sort().join(', ')}\n`;
    }

    if (data.wrongLetters.length > 0) {
      const wrongDisplay = data.wrongLetters
        .filter((l) => !l.includes('(palavra)'))
        .sort()
        .join(', ');
      if (wrongDisplay) {
        description += `❌ **Letras erradas:** ${wrongDisplay}\n`;
      }
    }

    description += `\n🎯 **Tentativas restantes:** ${data.maxWrongGuesses - data.wrongLetters.length}`;

    // Players participating
    if (this.session.players.length > 1) {
      description += `\n\n👥 **Jogadores:** ${this.session.players.map((p) => p.username).join(', ')}`;
    }

    const color = data.gameOver ? (data.won ? 0x00ff00 : 0xff0000) : 0x3498db;

    return GameUtils.createGameEmbed('🔤 Palavra Secreta', description, color);
  }

  getLetterButtons() {
    const data = this.session.data as SecretWordData;

    if (data.gameOver) return [];

    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    const availableLetters = alphabet.filter(
      (letter) =>
        !data.guessedLetters.includes(letter) &&
        !data.wrongLetters.includes(letter),
    );

    const buttons = [];
    const buttonsPerRow = 5;

    for (let i = 0; i < availableLetters.length; i += buttonsPerRow) {
      const rowLetters = availableLetters.slice(i, i + buttonsPerRow);

      buttons.push(
        GameUtils.createGameButtons({
          labels: rowLetters,
          customIds: rowLetters.map((letter) => `word_letter_${letter}`),
          styles: rowLetters.map(() => ButtonStyle.Secondary),
        }),
      );
    }

    return buttons.slice(0, 5); // Limit to 5 rows
  }

  getActionButtons() {
    const data = this.session.data as SecretWordData;

    if (data.gameOver) return [];

    return [
      GameUtils.createGameButtons({
        labels: ['📝 Tentar Palavra Completa'],
        customIds: ['word_guess_complete'],
        styles: [ButtonStyle.Primary],
      }),
    ];
  }

  async finish(): Promise<GameResult> {
    const data = this.session.data as SecretWordData;
    const rewards: Record<string, any> = {};

    this.session.players.forEach((player, index) => {
      const baseRewards = this.calculateRewards(
        player,
        data.won ? 1 : this.session.players.length,
      );

      // Bonus XP for winning
      if (data.won) {
        baseRewards.xp += this.getDifficultyBonus() / 5;
        baseRewards.xp += Math.max(
          0,
          (data.maxWrongGuesses - data.wrongLetters.length) * 2,
        );
      }

      rewards[player.userId] = baseRewards;
    });

    return {
      sessionId: this.session.id,
      winners: data.won ? this.session.players.map((p) => p.userId) : [],
      losers: !data.won ? this.session.players.map((p) => p.userId) : [],
      rewards,
      stats: {
        word: data.word,
        category: data.category,
        difficulty: data.difficulty,
        won: data.won,
        wrongGuesses: data.wrongLetters.length,
        lettersGuessed: data.guessedLetters.length,
        wordLength: data.word.length,
      },
      duration: Date.now() - this.session.startedAt.getTime(),
    };
  }

  protected getBaseXpForGame(): number {
    return 20;
  }
}
