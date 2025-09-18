import { EmbedBuilder, ButtonStyle } from 'discord.js';
import { BaseGame, GameSession, GameResult, PlayerStatus } from '../core/GameTypes';
import { GameUtils } from '../core/GameUtils';

interface MazeData {
  maze: string[][];
  playerPosition: { x: number, y: number };
  exitPosition: { x: number, y: number };
  moves: number;
  gameOver: boolean;
  won: boolean;
  timeLimit: number;
  startTime: number;
}

export class MazeGame extends BaseGame {
  
  constructor(session: GameSession) {
    super(session);
    this.initializeGame();
  }

  private initializeGame(): void {
    const maze = this.generateMaze();
    const start = { x: 1, y: 1 };
    const exit = { x: 7, y: 7 };
    
    this.session.data = {
      maze,
      playerPosition: start,
      exitPosition: exit,
      moves: 0,
      gameOver: false,
      won: false,
      timeLimit: 300, // 5 minutes
      startTime: Date.now()
    } as MazeData;
    
    // Place player and exit
    maze[start.y][start.x] = '👤';
    maze[exit.y][exit.x] = '🏆';
  }

  private generateMaze(): string[][] {
    // Create a simple 9x9 maze
    const maze = [
      ['🧱', '🧱', '🧱', '🧱', '🧱', '🧱', '🧱', '🧱', '🧱'],
      ['🧱', '⬜', '⬜', '🧱', '⬜', '⬜', '⬜', '🧱', '🧱'],
      ['🧱', '⬜', '🧱', '🧱', '⬜', '🧱', '⬜', '🧱', '🧱'],
      ['🧱', '⬜', '⬜', '⬜', '⬜', '🧱', '⬜', '⬜', '🧱'],
      ['🧱', '🧱', '🧱', '⬜', '🧱', '🧱', '🧱', '⬜', '🧱'],
      ['🧱', '⬜', '⬜', '⬜', '⬜', '⬜', '⬜', '⬜', '🧱'],
      ['🧱', '⬜', '🧱', '🧱', '🧱', '🧱', '🧱', '⬜', '🧱'],
      ['🧱', '⬜', '⬜', '⬜', '⬜', '⬜', '⬜', '⬜', '🧱'],
      ['🧱', '🧱', '🧱', '🧱', '🧱', '🧱', '🧱', '🧱', '🧱']
    ];
    
    return maze;
  }

  async start(): Promise<void> {
    this.session.players[0].status = PlayerStatus.ACTIVE;
  }

  async handlePlayerAction(userId: string, action: any): Promise<void> {
    const data = this.session.data as MazeData;
    
    if (data.gameOver || this.isTimeUp()) return;

    if (action.type === 'move') {
      await this.movePlayer(action.direction);
    }
  }

  private async movePlayer(direction: string): Promise<void> {
    const data = this.session.data as MazeData;
    
    let newX = data.playerPosition.x;
    let newY = data.playerPosition.y;
    
    switch (direction) {
      case 'up':
        newY--;
        break;
      case 'down':
        newY++;
        break;
      case 'left':
        newX--;
        break;
      case 'right':
        newX++;
        break;
      default:
        return;
    }
    
    // Check bounds and walls
    if (newX < 0 || newX >= 9 || newY < 0 || newY >= 9) return;
    if (data.maze[newY][newX] === '🧱') return;
    
    // Clear old position
    data.maze[data.playerPosition.y][data.playerPosition.x] = '⬜';
    
    // Update position
    data.playerPosition.x = newX;
    data.playerPosition.y = newY;
    data.moves++;
    
    // Check if reached exit
    if (newX === data.exitPosition.x && newY === data.exitPosition.y) {
      data.won = true;
      data.gameOver = true;
      data.maze[newY][newX] = '🎉';
      await this.updateScores();
    } else {
      data.maze[newY][newX] = '👤';
    }
  }

  private isTimeUp(): boolean {
    const data = this.session.data as MazeData;
    return Date.now() - data.startTime > data.timeLimit * 1000;
  }

  private async updateScores(): Promise<void> {
    const data = this.session.data as MazeData;
    
    if (data.won) {
      const baseScore = 200;
      const moveBonus = Math.max(0, 100 - data.moves);
      const timeBonus = this.calculateTimeBonus();
      const score = baseScore + moveBonus + timeBonus;
      
      this.updatePlayerScore(this.session.players[0].userId, score);
    }
  }

  private calculateTimeBonus(): number {
    const data = this.session.data as MazeData;
    const elapsed = Date.now() - data.startTime;
    const remaining = Math.max(0, data.timeLimit * 1000 - elapsed);
    return Math.floor((remaining / (data.timeLimit * 1000)) * 50);
  }

  getGameEmbed(): EmbedBuilder {
    const data = this.session.data as MazeData;
    const player = this.session.players[0];
    const timeRemaining = Math.max(0, data.timeLimit - Math.floor((Date.now() - data.startTime) / 1000));
    
    let description = `👤 **Jogador:** ${player.username}\n\n`;
    
    if (data.gameOver) {
      if (data.won) {
        description += `🎉 **PARABÉNS! Você escapou do labirinto!**\n`;
        description += `🚶 **Movimentos:** ${data.moves}\n`;
        description += `⏱️ **Tempo:** ${Math.floor((Date.now() - data.startTime) / 1000)}s\n\n`;
      }
    } else if (this.isTimeUp()) {
      description += `⏰ **Tempo esgotado!**\n\n`;
      data.gameOver = true;
    } else {
      description += `🏃 **Escape do labirinto!**\n`;
      description += `🚶 **Movimentos:** ${data.moves}\n`;
      description += `⏱️ **Tempo restante:** ${GameUtils.formatTime(timeRemaining)}\n\n`;
    }
    
    // Display maze
    description += '```\n';
    for (let y = 0; y < data.maze.length; y++) {
      description += data.maze[y].join('') + '\n';
    }
    description += '```\n';
    
    description += `**Legenda:**\n`;
    description += `👤 Você | 🏆 Saída | 🧱 Parede | ⬜ Caminho`;

    const color = data.gameOver ? (data.won ? 0x00ff00 : 0xff0000) : 0x3498db;
    
    return GameUtils.createGameEmbed('🏃 Labirinto Mental', description, color);
  }

  getMovementButtons() {
    const data = this.session.data as MazeData;
    
    if (data.gameOver || this.isTimeUp()) return [];

    return [
      GameUtils.createGameButtons({
        labels: ['⬆️'],
        customIds: ['maze_up'],
        styles: [ButtonStyle.Primary]
      }),
      GameUtils.createGameButtons({
        labels: ['⬅️', '⬇️', '➡️'],
        customIds: ['maze_left', 'maze_down', 'maze_right'],
        styles: [ButtonStyle.Primary, ButtonStyle.Primary, ButtonStyle.Primary]
      })
    ];
  }

  async finish(): Promise<GameResult> {
    const data = this.session.data as MazeData;
    const player = this.session.players[0];
    const rewards = this.calculateRewards(player, 1);
    
    if (data.won) {
      rewards.xp += 30;
      // Bonus for efficiency
      if (data.moves < 20) {
        rewards.xp += 20;
      } else if (data.moves < 30) {
        rewards.xp += 10;
      }
    }

    return {
      sessionId: this.session.id,
      winners: data.won ? [player.userId] : [],
      losers: !data.won ? [player.userId] : [],
      rewards: { [player.userId]: rewards },
      stats: {
        won: data.won,
        moves: data.moves,
        timeUsed: Date.now() - data.startTime,
        efficiency: data.moves / 15 // Optimal path is about 15 moves
      },
      duration: Date.now() - this.session.startedAt.getTime()
    };
  }

  protected getBaseXpForGame(): number {
    return 30;
  }
}
