import {
  applyRouletteAction,
  createRouletteChambers,
  createRouletteState,
  getRouletteBulletCount,
  getRouletteRewardBonuses,
  getRouletteScores,
  ROULETTE_CHAMBER_COUNT,
  type RouletteState,
} from '@marquinhos/domain/games/casino/roulette';
import { ButtonStyle, EmbedBuilder } from 'discord.js';
import { z } from 'zod';
import {
  BaseGame,
  GameResult,
  GameReward,
  GameSession,
  PlayerStatus,
} from '../core/GameTypes';
import { GameUtils } from '../core/GameUtils';
import { UserFacingError } from '../core/UserFacingError';

const RouletteActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('pull_trigger') }),
  z.object({ type: z.literal('spin_chamber') }),
]);

type RouletteAction = z.infer<typeof RouletteActionSchema>;

export class RouletteGame extends BaseGame<RouletteState, RouletteAction> {
  constructor(session: GameSession) {
    super(session);
    this.initializeGame();
  }

  private initializeGame(): void {
    const bullets = getRouletteBulletCount(Math.random());
    this.data = createRouletteState(
      this.session.players.map(({ userId, username }) => ({
        userId,
        username,
      })),
      bullets,
      this.setupChambers(ROULETTE_CHAMBER_COUNT, bullets),
    );
  }

  private setupChambers(total: number, bullets: number): boolean[] {
    const bulletPositions = GameUtils.getRandomElements(
      Array.from({ length: total }, (_, i) => i),
      bullets,
    );
    return GameUtils.shuffleArray(
      createRouletteChambers(total, bulletPositions),
    );
  }

  async start(): Promise<void> {
    this.session.players.forEach((p) => (p.status = PlayerStatus.ACTIVE));
  }

  async handlePlayerAction(
    userId: string,
    action: RouletteAction,
  ): Promise<void> {
    const parsed = RouletteActionSchema.parse(action);
    const state = this.data;
    const spunChambers =
      parsed.type === 'spin_chamber'
        ? GameUtils.shuffleArray(state.chambers)
        : undefined;
    const result = applyRouletteAction(state, userId, parsed, spunChambers);

    if (result.error === 'not-your-turn') {
      throw new UserFacingError('Não é sua vez!');
    }

    this.data = result.state;
    if (parsed.type === 'pull_trigger') {
      const scores = getRouletteScores(this.data);
      for (const [playerId, score] of Object.entries(scores)) {
        this.updatePlayerScore(playerId, score);
      }
    }
  }

  getGameEmbed(): EmbedBuilder {
    const data = this.data;

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

    return GameUtils.createGameEmbed(
      '🔫 Roleta Russa',
      description,
      color,
      data.gameOver ? undefined : this.session.expiresAt,
    );
  }

  getActionButtons() {
    const data = this.data;

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
    const data = this.data;
    const winners: string[] = [];
    const losers: string[] = [];
    const rewards: Record<string, GameReward> = {};

    const rewardBonuses = getRouletteRewardBonuses(data);

    data.players.forEach((roulettePlayer) => {
      const player = this.session.players.find(
        (sessionPlayer) => sessionPlayer.userId === roulettePlayer.userId,
      )!;
      const bonus = rewardBonuses[player.userId]!;
      const baseRewards = this.calculateRewards(player, bonus.rank);
      baseRewards.xp += bonus.xpBonus;
      rewards[player.userId] = baseRewards;

      if (bonus.won) winners.push(player.userId);
      else losers.push(player.userId);
    });

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
    return 30;
  }
}
