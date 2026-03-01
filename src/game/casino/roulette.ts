import { EmbedBuilder, ButtonStyle } from 'discord.js';
import {
  BaseGame,
  GameSession,
  GameResult,
  PlayerStatus,
} from '../core/GameTypes';
import { GameUtils } from '../core/GameUtils';

interface RouletteData {
  chambers: boolean[]; // true = bullet, false = empty
  currentChamber: number;
  totalChambers: number;
  bullets: number;
  survived: number;
  gameOver: boolean;
  result: 'survived' | 'dead' | null;
  players: RoulettePlayer[];
  currentPlayerIndex: number;
  mode: 'solo' | 'multiplayer';
}

interface RoulettePlayer {
  userId: string;
  username: string;
  alive: boolean;
  survived: number;
}

export class RouletteGame extends BaseGame {
  constructor(session: GameSession) {
    super(session);
    this.initializeGame();
  }

  private initializeGame(): void {
    const bullets = Math.floor(Math.random() * 2) + 1; // 1-2 bullets
    const chambers = this.setupChambers(6, bullets);

    this.session.data = {
      chambers,
      currentChamber: 0,
      totalChambers: 6,
      bullets,
      survived: 0,
      gameOver: false,
      result: null,
      players: this.session.players.map((p) => ({
        userId: p.userId,
        username: p.username,
        alive: true,
        survived: 0,
      })),
      currentPlayerIndex: 0,
      mode: this.session.players.length > 1 ? 'multiplayer' : 'solo',
    } as RouletteData;
  }

  private setupChambers(total: number, bullets: number): boolean[] {
    const chambers = new Array(total).fill(false);
    const bulletPositions = GameUtils.getRandomElements(
      Array.from({ length: total }, (_, i) => i),
      bullets,
    );

    bulletPositions.forEach((pos) => {
      chambers[pos] = true;
    });

    return GameUtils.shuffleArray(chambers);
  }

  async start(): Promise<void> {
    this.session.players.forEach((p) => (p.status = PlayerStatus.ACTIVE));
  }

  async handlePlayerAction(userId: string, action: any): Promise<void> {
    const data = this.session.data as RouletteData;

    if (data.gameOver) return;

    // Check if it's the player's turn (in multiplayer)
    if (data.mode === 'multiplayer') {
      const currentPlayer = data.players[data.currentPlayerIndex];
      if (currentPlayer.userId !== userId) return;
    }

    if (action.type === 'pull_trigger') {
      await this.pullTrigger();
    } else if (action.type === 'spin_chamber') {
      await this.spinChamber();
    }
  }

  private async pullTrigger(): Promise<void> {
    const data = this.session.data as RouletteData;
    const currentPlayer =
      data.mode === 'multiplayer'
        ? data.players[data.currentPlayerIndex]
        : data.players[0];

    const hasBullet = data.chambers[data.currentChamber];

    if (hasBullet) {
      // Player is out
      currentPlayer.alive = false;
      data.gameOver = true;
      data.result = data.mode === 'solo' ? 'dead' : null;

      if (data.mode === 'multiplayer') {
        const alivePlayers = data.players.filter((p) => p.alive);
        if (alivePlayers.length <= 1) {
          data.gameOver = true;
        }
      }
    } else {
      // Survived this round
      currentPlayer.survived++;
      data.survived++;
      data.currentChamber = (data.currentChamber + 1) % data.totalChambers;

      if (data.mode === 'multiplayer') {
        // Next player's turn
        do {
          data.currentPlayerIndex =
            (data.currentPlayerIndex + 1) % data.players.length;
        } while (
          !data.players[data.currentPlayerIndex].alive &&
          data.players.filter((p) => p.alive).length > 1
        );
      }

      // Solo mode: Check if survived all chambers
      if (data.mode === 'solo' && data.currentChamber === 0) {
        data.gameOver = true;
        data.result = 'survived';
      }
    }

    // Update scores
    this.updateScores();
  }

  private async spinChamber(): Promise<void> {
    const data = this.session.data as RouletteData;

    // Re-randomize the chambers (costs survival points in solo mode)
    if (data.mode === 'solo' && data.survived > 0) {
      data.survived = Math.max(0, data.survived - 1);
    }

    data.chambers = GameUtils.shuffleArray(data.chambers);
    data.currentChamber = 0;
  }

  private updateScores(): void {
    const data = this.session.data as RouletteData;

    if (data.mode === 'solo') {
      const survivalBonus = data.survived * 10;
      const completionBonus = data.result === 'survived' ? 100 : 0;
      this.updatePlayerScore(
        this.session.players[0].userId,
        survivalBonus + completionBonus,
      );
    } else {
      // Multiplayer scoring
      data.players.forEach((roulettePlayer) => {
        const player = this.session.players.find(
          (p) => p.userId === roulettePlayer.userId,
        );
        if (player) {
          const score =
            roulettePlayer.survived * 15 + (roulettePlayer.alive ? 50 : 0);
          this.updatePlayerScore(player.userId, score);
        }
      });
    }
  }

  getGameEmbed(): EmbedBuilder {
    const data = this.session.data as RouletteData;

    let description = '';

    if (data.mode === 'solo') {
      const player = this.session.players[0];
      description += `👤 **Jogador:** ${player.username}\n`;
      description += `🔫 **Balas no tambor:** ${data.bullets}/${data.totalChambers}\n`;
      description += `💀 **Câmara atual:** ${data.currentChamber + 1}/${data.totalChambers}\n`;
      description += `🎯 **Sobreviveu:** ${data.survived} vezes\n\n`;

      if (data.gameOver) {
        if (data.result === 'dead') {
          description += `💀 **BANG!** Você encontrou a bala!\n`;
          description += `⚰️ **Game Over** - Você sobreviveu ${data.survived} rodadas.`;
        } else {
          description += `🎉 **PARABÉNS!** Você sobreviveu a todas as câmaras!\n`;
          description += `👑 **Vitória épica!** - ${data.survived} sobrevivências.`;
        }
      } else {
        description += `🤔 **Sua vez!** Puxe o gatilho ou gire o tambor...\n`;
        description += `⚠️ **Atenção:** Girar o tambor custa 1 ponto de sobrevivência.`;
      }
    } else {
      // Multiplayer mode
      description += `👥 **Jogadores vivos:** ${data.players.filter((p) => p.alive).length}/${data.players.length}\n`;
      description += `🔫 **Balas no tambor:** ${data.bullets}/${data.totalChambers}\n`;
      description += `💀 **Câmara atual:** ${data.currentChamber + 1}/${data.totalChambers}\n\n`;

      if (data.gameOver) {
        const survivors = data.players.filter((p) => p.alive);
        if (survivors.length === 1) {
          description += `👑 **VENCEDOR:** ${survivors[0].username}\n`;
        } else {
          description += `🎉 **SOBREVIVENTES:**\n`;
          survivors.forEach((p) => {
            description += `• ${p.username} (${p.survived} sobrevivências)\n`;
          });
        }
      } else {
        const currentPlayer = data.players[data.currentPlayerIndex];
        description += `🎯 **Vez de:** ${currentPlayer.username}\n\n`;

        description += `**Status dos jogadores:**\n`;
        data.players.forEach((p) => {
          const status = p.alive ? '🟢' : '💀';
          description += `${status} ${p.username} - ${p.survived} sobrevivências\n`;
        });
      }
    }

    const color = data.gameOver
      ? data.result === 'survived' ||
        data.players.filter((p) => p.alive).length > 0
        ? 0x00ff00
        : 0xff0000
      : 0xffaa00;

    return GameUtils.createGameEmbed('🔫 Roleta Russa', description, color);
  }

  getActionButtons() {
    const data = this.session.data as RouletteData;

    if (data.gameOver) {
      return [];
    }

    const buttons = [
      GameUtils.createGameButtons({
        labels: ['🔫 Puxar Gatilho'],
        customIds: ['roulette_trigger'],
        styles: [ButtonStyle.Danger],
      }),
    ];

    // Add spin option for solo mode or first turn
    if (data.mode === 'solo' || data.currentChamber === 0) {
      buttons.push(
        GameUtils.createGameButtons({
          labels: ['🔄 Girar Tambor'],
          customIds: ['roulette_spin'],
          styles: [ButtonStyle.Secondary],
        }),
      );
    }

    return buttons;
  }

  async finish(): Promise<GameResult> {
    const data = this.session.data as RouletteData;
    let winners: string[] = [];
    let losers: string[] = [];
    const rewards: Record<string, any> = {};

    if (data.mode === 'solo') {
      const player = this.session.players[0];
      const baseRewards = this.calculateRewards(player, 1);

      if (data.result === 'survived') {
        winners.push(player.userId);
        baseRewards.xp += 30; // Bonus for full survival
      } else {
        losers.push(player.userId);
      }

      // Survival bonus XP
      baseRewards.xp += data.survived * 3;
      rewards[player.userId] = baseRewards;
    } else {
      // Multiplayer results
      const alivePlayers = data.players.filter((p) => p.alive);
      const deadPlayers = data.players.filter((p) => !p.alive);

      alivePlayers.forEach((roulettePlayer, index) => {
        const player = this.session.players.find(
          (p) => p.userId === roulettePlayer.userId,
        )!;
        const baseRewards = this.calculateRewards(player, index + 1);
        baseRewards.xp += roulettePlayer.survived * 5;

        if (alivePlayers.length === 1) {
          baseRewards.xp += 40; // Winner bonus
        }

        winners.push(player.userId);
        rewards[player.userId] = baseRewards;
      });

      deadPlayers.forEach((roulettePlayer) => {
        const player = this.session.players.find(
          (p) => p.userId === roulettePlayer.userId,
        )!;
        const baseRewards = this.calculateRewards(player, data.players.length);
        baseRewards.xp += roulettePlayer.survived * 2;

        losers.push(player.userId);
        rewards[player.userId] = baseRewards;
      });
    }

    return {
      sessionId: this.session.id,
      winners,
      losers,
      rewards,
      stats: {
        mode: data.mode,
        bullets: data.bullets,
        totalSurvived:
          data.mode === 'solo'
            ? data.survived
            : data.players.reduce((sum, p) => sum + p.survived, 0),
        playersCount: data.players.length,
      },
      duration: Date.now() - this.session.startedAt.getTime(),
    };
  }

  protected getBaseXpForGame(): number {
    return 20;
  }
}
