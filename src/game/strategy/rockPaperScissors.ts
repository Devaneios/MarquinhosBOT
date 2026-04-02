import { ButtonStyle, EmbedBuilder } from 'discord.js';
import {
  BaseGame,
  GameResult,
  GameReward,
  GameSession,
  PlayerStatus,
} from '../core/GameTypes';
import { GameUtils } from '../core/GameUtils';

interface RPSData {
  rounds: number;
  currentRound: number;
  playerChoices: Record<string, string>;
  scores: Record<string, number>;
  roundResults: RoundResult[];
  finished: boolean;
  waitingForChoices: boolean;
}

interface RoundResult {
  round: number;
  choices: Record<string, string>;
  winners: string[];
  eliminated: string[];
}

export class RockPaperScissorsGame extends BaseGame {
  private readonly choices = {
    rock: { emoji: '🪨', beats: 'scissors' },
    paper: { emoji: '📄', beats: 'rock' },
    scissors: { emoji: '✂️', beats: 'paper' },
  };

  constructor(session: GameSession) {
    super(session);
    this.initializeGame();
  }

  private initializeGame(): void {
    this.session.data = {
      rounds: 5,
      currentRound: 1,
      playerChoices: {},
      scores: {},
      roundResults: [],
      finished: false,
      waitingForChoices: true,
    } as RPSData;
    const data = this.session.data as RPSData;

    this.session.players.forEach((player) => {
      data.scores[player.userId] = 0;
    });
  }

  async start(): Promise<void> {
    this.session.players.forEach((p) => (p.status = PlayerStatus.ACTIVE));
  }

  async handlePlayerAction(
    userId: string,
    action: Record<string, unknown>,
  ): Promise<void> {
    const data = this.session.data as RPSData;

    if (data.finished || !data.waitingForChoices) return;

    if (action.type === 'choose') {
      await this.submitChoice(userId, action.choice as string);
    }
  }

  private async submitChoice(userId: string, choice: string): Promise<void> {
    const data = this.session.data as RPSData;

    if (!['rock', 'paper', 'scissors'].includes(choice)) return;

    data.playerChoices[userId] = choice;

    // Check if all players made their choice
    const allChosen = this.session.players.every(
      (p) => data.playerChoices[p.userId],
    );

    if (allChosen) {
      await this.resolveRound();
    }
  }

  private async resolveRound(): Promise<void> {
    const data = this.session.data as RPSData;

    const winners = this.determineRoundWinners();
    const eliminated: string[] = [];

    // Award points to winners
    winners.forEach((userId) => {
      data.scores[userId] += 10;
      this.updatePlayerScore(userId, data.scores[userId]);
    });

    const roundResult: RoundResult = {
      round: data.currentRound,
      choices: { ...data.playerChoices },
      winners,
      eliminated,
    };

    data.roundResults.push(roundResult);
    data.currentRound++;
    data.playerChoices = {};

    if (data.currentRound > data.rounds) {
      data.finished = true;
      data.waitingForChoices = false;
    } else {
      data.waitingForChoices = true;
    }
  }

  private determineRoundWinners(): string[] {
    const data = this.session.data as RPSData;
    const choiceGroups: Record<string, string[]> = {
      rock: [],
      paper: [],
      scissors: [],
    };

    // Group players by their choices
    Object.entries(data.playerChoices).forEach(([userId, choice]) => {
      choiceGroups[choice].push(userId);
    });

    // Determine winners based on RPS rules
    const nonEmptyChoices = Object.entries(choiceGroups).filter(
      ([_, players]) => players.length > 0,
    );

    if (nonEmptyChoices.length === 1 || nonEmptyChoices.length === 3) {
      // All players chose the same or all three choices were made - tie
      return [];
    }

    if (nonEmptyChoices.length === 2) {
      const [choice1, players1] = nonEmptyChoices[0];
      const [choice2, players2] = nonEmptyChoices[1];

      if (
        this.choices[choice1 as keyof typeof this.choices].beats === choice2
      ) {
        return players1;
      } else {
        return players2;
      }
    }

    return [];
  }

  getGameEmbed(): EmbedBuilder {
    const data = this.session.data as RPSData;

    let description = '';

    if (data.finished) {
      description += '🏁 **Jogo Finalizado!**\n\n';

      // Final scores
      const sortedPlayers = this.session.players.sort(
        (a, b) => (data.scores[b.userId] || 0) - (data.scores[a.userId] || 0),
      );

      description += '🏆 **Pontuação Final:**\n';
      sortedPlayers.forEach((player, index) => {
        const score = data.scores[player.userId] || 0;
        const medal = GameUtils.getPositionMedal(index + 1);
        description += `${medal} **${player.username}** - ${score} pontos\n`;
      });
    } else {
      description += `🎮 **Rodada ${data.currentRound}/${data.rounds}**\n\n`;

      if (data.waitingForChoices) {
        description += '⏳ **Façam suas escolhas!**\n\n';

        // Show who already chose
        const chosen = this.session.players.filter(
          (p) => data.playerChoices[p.userId],
        );
        const waiting = this.session.players.filter(
          (p) => !data.playerChoices[p.userId],
        );

        if (chosen.length > 0) {
          description += `✅ **Escolheram:** ${chosen.map((p) => p.username).join(', ')}\n`;
        }
        if (waiting.length > 0) {
          description += `⏳ **Aguardando:** ${waiting.map((p) => p.username).join(', ')}\n`;
        }
      }
    }

    // Show last round result
    if (data.roundResults.length > 0) {
      const lastResult = data.roundResults[data.roundResults.length - 1];
      description += `\n**Última rodada:**\n`;

      Object.entries(lastResult.choices).forEach(([userId, choice]) => {
        const player = this.session.players.find((p) => p.userId === userId);
        const emoji = this.choices[choice as keyof typeof this.choices].emoji;
        description += `${emoji} ${player?.username}\n`;
      });

      if (lastResult.winners.length > 0) {
        const winners = lastResult.winners
          .map(
            (id) => this.session.players.find((p) => p.userId === id)?.username,
          )
          .join(', ');
        description += `🎉 **Vencedores:** ${winners}\n`;
      } else {
        description += `🤝 **Empate nesta rodada!**\n`;
      }
    }

    const color = data.finished ? 0x00ff00 : 0x3498db;

    return GameUtils.createGameEmbed(
      '✂️ Pedra, Papel, Tesoura',
      description,
      color,
    );
  }

  getChoiceButtons() {
    const data = this.session.data as RPSData;

    if (data.finished || !data.waitingForChoices) return [];

    return [
      GameUtils.createGameButtons({
        labels: ['🪨 Pedra', '📄 Papel', '✂️ Tesoura'],
        customIds: ['rps_rock', 'rps_paper', 'rps_scissors'],
        styles: [
          ButtonStyle.Secondary,
          ButtonStyle.Secondary,
          ButtonStyle.Secondary,
        ],
      }),
    ];
  }

  async finish(): Promise<GameResult> {
    const data = this.session.data as RPSData;
    const sortedPlayers = this.session.players.sort(
      (a, b) => (data.scores[b.userId] || 0) - (data.scores[a.userId] || 0),
    );

    const rewards: Record<string, GameReward> = {};

    sortedPlayers.forEach((player, index) => {
      const baseRewards = this.calculateRewards(player, index + 1);
      const score = data.scores[player.userId] || 0;
      baseRewards.xp += Math.floor(score / 5);
      rewards[player.userId] = baseRewards;
    });

    return {
      sessionId: this.session.id,
      winners: sortedPlayers.length > 0 ? [sortedPlayers[0].userId] : [],
      losers: sortedPlayers.slice(1).map((p) => p.userId),
      rewards,
      stats: {
        rounds: data.rounds,
        roundResults: data.roundResults,
        finalScores: data.scores,
      },
      duration: Date.now() - this.session.startedAt.getTime(),
    };
  }

  protected getBaseXpForGame(): number {
    return 8;
  }
}
