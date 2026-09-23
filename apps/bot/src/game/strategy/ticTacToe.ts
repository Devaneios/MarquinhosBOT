import {
  applyTicTacToeMove,
  createTicTacToeState,
  forfeitTicTacToeTurn,
  getTicTacToeRewardBonuses,
  getTicTacToeScores,
  type TicTacToeState,
} from '@marquinhos/domain/bot/ticTacToe';
import { updateSessionMessage } from '@marquinhos/lib/gameLifecycle';
import { logger } from '@marquinhos/utils/logger';
import { ButtonStyle, EmbedBuilder } from 'discord.js';
import { z } from 'zod';
import { GameManager } from '../core/GameManager';
import {
  BaseGame,
  GameResult,
  GameReward,
  GameSession,
  PlayerStatus,
} from '../core/GameTypes';
import { GameUtils } from '../core/GameUtils';
import { UserFacingError } from '../core/UserFacingError';

const gameManager = GameManager.getInstance();

const TicTacToeActionSchema = z.object({
  type: z.literal('move'),
  row: z.number(),
  col: z.number(),
});

type TicTacToeAction = z.infer<typeof TicTacToeActionSchema>;

export class TicTacToeGame extends BaseGame<TicTacToeState, TicTacToeAction> {
  private turnTimer: ReturnType<typeof setTimeout> | null = null;
  private static readonly TURN_TIMEOUT_MS = 60_000; // 60 seconds

  constructor(session: GameSession) {
    super(session);
    this.initializeGame();
  }

  private initializeGame(): void {
    this.data = createTicTacToeState();
  }

  async start(): Promise<void> {
    this.session.players.forEach((p) => (p.status = PlayerStatus.ACTIVE));
    this.resetTurnTimer();
  }

  /** Resets the turn timer. Called after each move. */
  private resetTurnTimer(): void {
    this.clearTurnTimer();
    this.turnTimer = setTimeout(() => {
      const data = this.data;
      if (data.gameOver) return;

      // The current player timed out — other player wins
      this.data = forfeitTicTacToeTurn(data, data.currentPlayer);

      this.updateScores()
        .then(() => this.finish())
        .then((result) =>
          gameManager.endSessionWithResult(this.session.id, result),
        )
        .then(() => updateSessionMessage(this.session, this.getGameEmbed(), []))
        .catch((err) =>
          logger.error('TicTacToe turn timeout finish flow failed:', err),
        );
    }, TicTacToeGame.TURN_TIMEOUT_MS);
  }

  private clearTurnTimer(): void {
    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = null;
    }
  }

  async handlePlayerAction(
    userId: string,
    action: TicTacToeAction,
  ): Promise<void> {
    const parsed = TicTacToeActionSchema.parse(action);
    const data = this.data;

    if (data.gameOver) return;

    // Check if it's the player's turn
    if (this.session.players[data.currentPlayer].userId !== userId) {
      throw new UserFacingError('Não é sua vez!');
    }

    if (parsed.type === 'move') {
      await this.makeMove(parsed.row, parsed.col);
    }
  }

  private async makeMove(row: number, col: number): Promise<void> {
    const state = this.data;
    const updated = applyTicTacToeMove(state, row, col);
    if (updated === state) return;
    this.data = updated;

    if (this.data.gameOver) {
      await this.updateScores();
      this.clearTurnTimer();
    } else {
      this.resetTurnTimer();
    }
  }

  private async updateScores(): Promise<void> {
    const scores = getTicTacToeScores(this.data);
    this.session.players.forEach((player, index) => {
      this.updatePlayerScore(player.userId, scores[index] ?? 0);
    });
  }

  getGameEmbed(): EmbedBuilder {
    const data = this.data;

    const winner =
      data.winnerIndex === null
        ? null
        : this.session.players[data.winnerIndex]?.userId;
    let description = '';

    // Game status
    if (data.gameOver) {
      if (winner) {
        const winningPlayer = this.session.players.find(
          (p) => p.userId === winner,
        );
        if (data.timedOut) {
          const loser = this.session.players.find((p) => p.userId !== winner);
          description += `⏰ **${loser?.username} demorou demais!** ${winningPlayer?.username} venceu!\n\n`;
        } else {
          description += `🎉 **${winningPlayer?.username} venceu!**\n\n`;
        }
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
      description += `${data.board[i].map((cell) => (cell === 'X' ? '❌' : cell === 'O' ? '⭕' : '⬜')).join(' ')}\n`;
    }
    description += '```\n';

    // Players
    description += `**Jogadores:**\n`;
    description += `❌ ${this.session.players[0].username}\n`;
    description += `⭕ ${this.session.players[1].username}`;

    const color = data.gameOver ? (winner ? 0x00ff00 : 0xffaa00) : 0x3498db;

    return GameUtils.createGameEmbed(
      '⭕ Jogo da Velha',
      description,
      color,
      data.gameOver ? undefined : this.session.expiresAt,
    );
  }

  getBoardButtons() {
    const data = this.data;

    if (data.gameOver) return [];

    const buttons = [];

    for (let row = 0; row < 3; row++) {
      const rowButtons = [];
      for (let col = 0; col < 3; col++) {
        const cell = data.board[row][col];
        const isOccupied = cell !== null;
        rowButtons.push({
          label: cell === 'X' ? '❌' : cell === 'O' ? '⭕' : '⬜',
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
    this.clearTurnTimer();
    const data = this.data;
    const rewards: Record<string, GameReward> = {};
    const rewardBonuses = getTicTacToeRewardBonuses(data);

    this.session.players.forEach((player, index) => {
      const isWinner = data.winnerIndex === index;
      const baseRewards = this.calculateRewards(player, isWinner ? 1 : 2);
      baseRewards.xp += rewardBonuses[index] ?? 0;

      rewards[player.userId] = baseRewards;
    });

    return {
      sessionId: this.session.id,
      winners:
        data.winnerIndex !== null
          ? [this.session.players[data.winnerIndex]!.userId]
          : [],
      losers:
        data.winnerIndex !== null
          ? this.session.players
              .filter((_, index) => index !== data.winnerIndex)
              .map((p) => p.userId)
          : this.session.players.map((p) => p.userId), // draw: record participation for both
      rewards,
      stats: {
        moves: data.moves,
        winner:
          data.winnerIndex === null
            ? null
            : this.session.players[data.winnerIndex]!.userId,
        isDraw: data.isDraw,
        gameLength: Date.now() - this.session.startedAt.getTime(),
      },
      duration: Date.now() - this.session.startedAt.getTime(),
    };
  }

  protected getBaseXpForGame(): number {
    return 5;
  }
}
