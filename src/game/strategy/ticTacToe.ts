import { EmbedBuilder, ButtonStyle } from 'discord.js';
import {
  BaseGame,
  GameSession,
  GameResult,
  PlayerStatus,
} from '../core/GameTypes';
import { GameUtils } from '../core/GameUtils';

interface TicTacToeData {
  board: string[][];
  currentPlayer: number;
  gameOver: boolean;
  winner: string | null;
  isDraw: boolean;
  moves: number;
}

export class TicTacToeGame extends BaseGame {
  constructor(session: GameSession) {
    super(session);
    this.initializeGame();
  }

  private initializeGame(): void {
    this.session.data = {
      board: [
        ['⬜', '⬜', '⬜'],
        ['⬜', '⬜', '⬜'],
        ['⬜', '⬜', '⬜'],
      ],
      currentPlayer: 0,
      gameOver: false,
      winner: null,
      isDraw: false,
      moves: 0,
    } as TicTacToeData;
  }

  async start(): Promise<void> {
    this.session.players.forEach((p) => (p.status = PlayerStatus.ACTIVE));
  }

  async handlePlayerAction(userId: string, action: any): Promise<void> {
    const data = this.session.data as TicTacToeData;

    if (data.gameOver) return;

    // Check if it's the player's turn
    if (this.session.players[data.currentPlayer].userId !== userId) return;

    if (action.type === 'move') {
      await this.makeMove(action.row, action.col);
    }
  }

  private async makeMove(row: number, col: number): Promise<void> {
    const data = this.session.data as TicTacToeData;

    // Check if move is valid
    if (
      row < 0 ||
      row > 2 ||
      col < 0 ||
      col > 2 ||
      data.board[row][col] !== '⬜'
    ) {
      return;
    }

    // Make the move
    const symbol = data.currentPlayer === 0 ? '❌' : '⭕';
    data.board[row][col] = symbol;
    data.moves++;

    // Check for winner
    if (this.checkWinner()) {
      data.gameOver = true;
      data.winner = this.session.players[data.currentPlayer].userId;
      await this.updateScores();
    } else if (data.moves === 9) {
      // Draw
      data.gameOver = true;
      data.isDraw = true;
      await this.updateScores();
    } else {
      // Switch players
      data.currentPlayer = data.currentPlayer === 0 ? 1 : 0;
    }
  }

  private checkWinner(): boolean {
    const data = this.session.data as TicTacToeData;
    const board = data.board;
    const symbol = data.currentPlayer === 0 ? '❌' : '⭕';

    // Check rows
    for (let i = 0; i < 3; i++) {
      if (
        board[i][0] === symbol &&
        board[i][1] === symbol &&
        board[i][2] === symbol
      ) {
        return true;
      }
    }

    // Check columns
    for (let i = 0; i < 3; i++) {
      if (
        board[0][i] === symbol &&
        board[1][i] === symbol &&
        board[2][i] === symbol
      ) {
        return true;
      }
    }

    // Check diagonals
    if (
      board[0][0] === symbol &&
      board[1][1] === symbol &&
      board[2][2] === symbol
    ) {
      return true;
    }
    if (
      board[0][2] === symbol &&
      board[1][1] === symbol &&
      board[2][0] === symbol
    ) {
      return true;
    }

    return false;
  }

  private async updateScores(): Promise<void> {
    const data = this.session.data as TicTacToeData;

    if (data.winner) {
      const winnerScore = 100;
      const loserScore = 20;

      this.session.players.forEach((player) => {
        const score = player.userId === data.winner ? winnerScore : loserScore;
        this.updatePlayerScore(player.userId, score);
      });
    } else if (data.isDraw) {
      // Draw - both players get 50 points
      this.session.players.forEach((player) => {
        this.updatePlayerScore(player.userId, 50);
      });
    }
  }

  getGameEmbed(): EmbedBuilder {
    const data = this.session.data as TicTacToeData;

    let description = '';

    // Game status
    if (data.gameOver) {
      if (data.winner) {
        const winner = this.session.players.find(
          (p) => p.userId === data.winner,
        );
        description += `🎉 **${winner?.username} venceu!**\n\n`;
      } else if (data.isDraw) {
        description += '🤝 **Empate!**\n\n';
      }
    } else {
      const currentPlayer = this.session.players[data.currentPlayer];
      const symbol = data.currentPlayer === 0 ? '❌' : '⭕';
      description += `${symbol} **Vez de ${currentPlayer.username}**\n\n`;
    }

    // Board display
    description += '```\n';
    for (let i = 0; i < 3; i++) {
      description += data.board[i].join(' ') + '\n';
    }
    description += '```\n';

    // Players
    description += `**Jogadores:**\n`;
    description += `❌ ${this.session.players[0].username}\n`;
    description += `⭕ ${this.session.players[1].username}`;

    const color = data.gameOver
      ? data.winner
        ? 0x00ff00
        : 0xffaa00
      : 0x3498db;

    return GameUtils.createGameEmbed('⭕ Jogo da Velha', description, color);
  }

  getBoardButtons() {
    const data = this.session.data as TicTacToeData;

    if (data.gameOver) return [];

    const buttons = [];

    for (let row = 0; row < 3; row++) {
      const rowButtons = [];
      for (let col = 0; col < 3; col++) {
        const isOccupied = data.board[row][col] !== '⬜';
        rowButtons.push({
          label: isOccupied ? data.board[row][col] : '⬜',
          customId: `ttt_move_${row}_${col}`,
          style: isOccupied ? ButtonStyle.Secondary : ButtonStyle.Primary,
          disabled: isOccupied,
        });
      }

      buttons.push(
        GameUtils.createGameButtons({
          labels: rowButtons.map((b) => b.label),
          customIds: rowButtons.map((b) => b.customId),
          styles: rowButtons.map((b) => b.style),
          disabled: rowButtons.map((b) => b.disabled),
        }),
      );
    }

    return buttons;
  }

  async finish(): Promise<GameResult> {
    const data = this.session.data as TicTacToeData;
    const rewards: Record<string, any> = {};

    this.session.players.forEach((player, index) => {
      const isWinner = player.userId === data.winner;
      const baseRewards = this.calculateRewards(player, isWinner ? 1 : 2);

      if (isWinner) {
        baseRewards.xp += 20;
      } else if (data.isDraw) {
        baseRewards.xp += 10;
      }

      rewards[player.userId] = baseRewards;
    });

    return {
      sessionId: this.session.id,
      winners: data.winner ? [data.winner] : [],
      losers: data.winner
        ? this.session.players
            .filter((p) => p.userId !== data.winner)
            .map((p) => p.userId)
        : [],
      rewards,
      stats: {
        moves: data.moves,
        winner: data.winner,
        isDraw: data.isDraw,
        gameLength: Date.now() - this.session.startedAt.getTime(),
      },
      duration: Date.now() - this.session.startedAt.getTime(),
    };
  }

  protected getBaseXpForGame(): number {
    return 15;
  }
}
