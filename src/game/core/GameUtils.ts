import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';
import { GamePlayer, GameSession, GameState, GameType } from './GameTypes';

export class GameUtils {
  static createGameEmbed(
    title: string,
    description: string,
    color?: number,
  ): EmbedBuilder {
    return new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setColor(color || 0x00ae86)
      .setTimestamp();
  }

  static createJoinButton(disabled = false): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('game_join')
        .setLabel('🎮 Entrar no Jogo')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disabled),
    );
  }

  static createLeaveButton(): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('game_leave')
        .setLabel('🚪 Sair do Jogo')
        .setStyle(ButtonStyle.Secondary),
    );
  }

  static createGameButtons(options: {
    labels: string[];
    customIds: string[];
    styles?: ButtonStyle[];
    disabled?: boolean[];
  }): ActionRowBuilder<ButtonBuilder> {
    const row = new ActionRowBuilder<ButtonBuilder>();

    options.labels.forEach((label, index) => {
      const button = new ButtonBuilder()
        .setCustomId(options.customIds[index])
        .setLabel(label)
        .setStyle(options.styles?.[index] || ButtonStyle.Primary)
        .setDisabled(options.disabled?.[index] || false);

      row.addComponents(button);
    });

    return row;
  }

  static createSelectMenu(
    customId: string,
    placeholder: string,
    options: {
      label: string;
      value: string;
      description?: string;
      emoji?: string;
    }[],
  ): ActionRowBuilder<StringSelectMenuBuilder> {
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(customId)
      .setPlaceholder(placeholder);

    options.forEach((option) => {
      const menuOption = new StringSelectMenuOptionBuilder()
        .setLabel(option.label)
        .setValue(option.value);

      if (option.description) menuOption.setDescription(option.description);
      if (option.emoji) menuOption.setEmoji(option.emoji);

      selectMenu.addOptions(menuOption);
    });

    return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      selectMenu,
    );
  }

  static formatPlayerList(players: GamePlayer[]): string {
    if (players.length === 0) return 'Nenhum jogador ainda';

    return players
      .map((player, index) => {
        const position = index + 1;
        const statusEmoji = this.getPlayerStatusEmoji(player.status);
        return `${position}. ${statusEmoji} **${player.username}** - ${player.score} pontos`;
      })
      .join('\n');
  }

  static formatLeaderboard(players: GamePlayer[], limit = 10): string {
    const sortedPlayers = [...players]
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    if (sortedPlayers.length === 0) return 'Nenhum jogador ainda';

    return sortedPlayers
      .map((player, index) => {
        const position = index + 1;
        const medal = this.getPositionMedal(position);
        return `${medal} **${player.username}** - ${player.score} pontos`;
      })
      .join('\n');
  }

  static getGameTypeEmoji(gameType: GameType): string {
    const emojis: Record<GameType, string> = {
      [GameType.BLACKJACK]: '🃏',
      [GameType.SLOTS]: '🎰',
      [GameType.ROULETTE]: '🎲',
      [GameType.DICE]: '🎲',
      [GameType.LOTTERY]: '🎫',
      [GameType.MUSIC_QUIZ]: '🎵',
      [GameType.POP_CULTURE]: '📺',
      [GameType.GEOGRAPHY]: '🌍',
      [GameType.BRAZIL_HISTORY]: '🇧🇷',
      [GameType.SECRET_WORD]: '🔤',
      [GameType.ANAGRAM]: '🔀',
      [GameType.RHYME]: '🎤',
      [GameType.TRANSLATE]: '🌐',
      [GameType.TIC_TAC_TOE]: '⭕',
      [GameType.SECRET_CODE]: '🔐',
      [GameType.ROCK_PAPER_SCISSORS]: '✂️',
      [GameType.MAZE]: '🏃',
      [GameType.BATTLE_ROYALE]: '⚔️',
      [GameType.TREASURE_HUNT]: '🗺️',
      [GameType.SPEED_MATH]: '➕',
    };

    return emojis[gameType] || '🎮';
  }

  static getGameTypeName(gameType: GameType): string {
    const names: Record<GameType, string> = {
      [GameType.BLACKJACK]: 'Blackjack',
      [GameType.SLOTS]: 'Caça-níqueis',
      [GameType.ROULETTE]: 'Roleta Russa',
      [GameType.DICE]: 'Dados Mágicos',
      [GameType.LOTTERY]: 'Loteria do Marquinhos',
      [GameType.MUSIC_QUIZ]: 'Quiz Musical',
      [GameType.POP_CULTURE]: 'Cultura Pop',
      [GameType.GEOGRAPHY]: 'Geografia Maluca',
      [GameType.BRAZIL_HISTORY]: 'História do Brasil',
      [GameType.SECRET_WORD]: 'Palavra Secreta',
      [GameType.ANAGRAM]: 'Anagrama Insano',
      [GameType.RHYME]: 'Rima Rápida',
      [GameType.TRANSLATE]: 'Traduzindo',
      [GameType.TIC_TAC_TOE]: 'Jogo da Velha',
      [GameType.SECRET_CODE]: 'Código Secreto',
      [GameType.ROCK_PAPER_SCISSORS]: 'Pedra, Papel, Tesoura',
      [GameType.MAZE]: 'Labirinto Mental',
      [GameType.BATTLE_ROYALE]: 'Battle Royale dos Emojis',
      [GameType.TREASURE_HUNT]: 'Caça ao Tesouro',
      [GameType.SPEED_MATH]: 'Speed Math',
    };

    return names[gameType] || 'Jogo Desconhecido';
  }

  static getPlayerStatusEmoji(status: string): string {
    switch (status) {
      case 'active':
        return '🟢';
      case 'waiting':
        return '🟡';
      case 'eliminated':
        return '🔴';
      case 'disconnected':
        return '⚫';
      default:
        return '⚪';
    }
  }

  static getPositionMedal(position: number): string {
    switch (position) {
      case 1:
        return '🥇';
      case 2:
        return '🥈';
      case 3:
        return '🥉';
      default:
        return `${position}.`;
    }
  }

  static getGameStateEmoji(state: GameState): string {
    switch (state) {
      case GameState.WAITING:
        return '⏳';
      case GameState.ACTIVE:
        return '🎮';
      case GameState.PAUSED:
        return '⏸️';
      case GameState.FINISHED:
        return '🏁';
      case GameState.CANCELLED:
        return '❌';
      default:
        return '❓';
    }
  }

  static formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  }

  static formatCooldownTime(seconds: number): string {
    if (seconds <= 0) return 'Disponível';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${remainingSeconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      return `${remainingSeconds}s`;
    }
  }

  static shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  static getRandomElement<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
  }

  static getRandomElements<T>(array: T[], count: number): T[] {
    const shuffled = this.shuffleArray(array);
    return shuffled.slice(0, count);
  }

  static createProgressBar(
    current: number,
    max: number,
    length: number = 10,
  ): string {
    const progress = Math.floor((current / max) * length);
    const empty = length - progress;
    return '█'.repeat(progress) + '░'.repeat(empty);
  }

  static validateGameAction(
    session: GameSession,
    userId: string,
  ): { valid: boolean; reason?: string } {
    if (session.state !== GameState.ACTIVE) {
      return { valid: false, reason: 'O jogo não está ativo' };
    }

    const player = session.players.find((p) => p.userId === userId);
    if (!player) {
      return { valid: false, reason: 'Você não está participando deste jogo' };
    }

    if (player.status !== 'active') {
      return { valid: false, reason: 'Você não pode jogar neste momento' };
    }

    if (session.currentTurn && session.currentTurn !== userId) {
      return { valid: false, reason: 'Não é sua vez de jogar' };
    }

    return { valid: true };
  }

  static createWinnerEmbed(
    winners: GamePlayer[],
    gameType: GameType,
  ): EmbedBuilder {
    const emoji = this.getGameTypeEmoji(gameType);
    const gameName = this.getGameTypeName(gameType);

    if (winners.length === 1) {
      return this.createGameEmbed(
        `${emoji} ${gameName} - Vitória!`,
        `🎉 **${winners[0].username}** venceu com **${winners[0].score}** pontos!`,
        0x00ff00,
      );
    } else {
      const winnersList = winners
        .map(
          (winner, index) =>
            `${this.getPositionMedal(index + 1)} **${winner.username}** - ${winner.score} pontos`,
        )
        .join('\n');

      return this.createGameEmbed(
        `${emoji} ${gameName} - Resultados!`,
        `🏆 **Vencedores:**\n${winnersList}`,
        0x00ff00,
      );
    }
  }

  static async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
