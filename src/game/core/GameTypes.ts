import {
  ActionRowBuilder,
  EmbedBuilder,
  MessageActionRowComponentBuilder,
} from 'discord.js';

export enum GameType {
  // Casino Games
  BLACKJACK = 'blackjack',
  SLOTS = 'slots',
  ROULETTE = 'roulette',
  DICE = 'dice',

  // Strategy Games
  TIC_TAC_TOE = 'tic_tac_toe',
  ROCK_PAPER_SCISSORS = 'rock_paper_scissors',
  MAZE = 'maze',
}

export enum GameState {
  WAITING = 'waiting',
  ACTIVE = 'active',
  PAUSED = 'paused',
  FINISHED = 'finished',
  CANCELLED = 'cancelled',
}

export enum PlayerStatus {
  ACTIVE = 'active',
  WAITING = 'waiting',
  ELIMINATED = 'eliminated',
  DISCONNECTED = 'disconnected',
}

export interface GamePlayer {
  userId: string;
  username: string;
  score: number;
  status: PlayerStatus;
  joinedAt: Date;
  data?: Record<string, unknown>; // Game-specific player data
}

export interface GameConfig {
  maxPlayers: number;
  minPlayers: number;
  timeLimit?: number; // in seconds
  difficulty?: 'easy' | 'medium' | 'hard';
  options?: Record<string, unknown>;
}

export interface GameReward {
  xp: number;
  achievement?: string;
  badge?: string;
  bonus?: number;
}

export interface GameSession {
  id: string;
  type: GameType;
  guildId: string;
  channelId: string;
  hostId: string;
  players: GamePlayer[];
  state: GameState;
  startedAt: Date;
  expiresAt: Date;
  config: GameConfig;
  data: unknown; // Game-specific session data
  round?: number;
  currentTurn?: string; // userId
}

export interface GameResult {
  sessionId: string;
  winners: string[];
  losers: string[];
  rewards: Record<string, GameReward>;
  stats: Record<string, unknown>;
  duration: number;
}

export interface GameQuestion {
  id: string;
  question: string;
  options?: string[];
  correctAnswer: string | number;
  difficulty: 'easy' | 'medium' | 'hard';
  category?: string;
  hint?: string;
  explanation?: string;
}

export interface GameStats {
  userId: string;
  guildId: string;
  gameType: GameType;
  gamesPlayed: number;
  gamesWon: number;
  totalScore: number;
  bestScore: number;
  totalXpEarned: number;
  winStreak: number;
  bestWinStreak: number;
  lastPlayed: Date;
  achievements: string[];
}

export interface ModalConfig {
  modalId: string;
  title: string;
  label: string;
  placeholder: string;
  maxLength?: number;
}

export type ButtonResult =
  | { kind: 'action'; action: Record<string, unknown> }
  | { kind: 'modal'; config: ModalConfig }
  | { kind: 'ignore' };

export type ButtonDescriptor =
  | { kind: 'static'; customId: string; result: ButtonResult }
  | { kind: 'prefix'; prefix: string; parse: (suffix: string) => ButtonResult };

export abstract class BaseGame {
  protected session: GameSession;

  constructor(session: GameSession) {
    this.session = session;
  }

  abstract start(): Promise<void>;
  abstract handlePlayerAction(
    userId: string,
    action: Record<string, unknown>,
  ): Promise<void>;
  abstract getGameEmbed(): EmbedBuilder;
  abstract finish(): Promise<GameResult>;

  protected addPlayer(userId: string, username: string): boolean {
    if (this.session.players.length >= this.session.config.maxPlayers) {
      return false;
    }

    const player: GamePlayer = {
      userId,
      username,
      score: 0,
      status: PlayerStatus.WAITING,
      joinedAt: new Date(),
    };

    this.session.players.push(player);
    return true;
  }

  protected removePlayer(userId: string): boolean {
    const index = this.session.players.findIndex((p) => p.userId === userId);
    if (index === -1) return false;

    this.session.players.splice(index, 1);
    return true;
  }

  protected getPlayer(userId: string): GamePlayer | undefined {
    return this.session.players.find((p) => p.userId === userId);
  }

  protected updatePlayerScore(userId: string, score: number): boolean {
    const player = this.getPlayer(userId);
    if (!player) return false;

    player.score = score;
    return true;
  }

  protected calculateRewards(player: GamePlayer, position: number): GameReward {
    const baseXp = this.getBaseXpForGame();
    let xp = baseXp;

    // Position bonus
    if (position === 1)
      xp *= 2; // Winner gets double
    else if (position === 2)
      xp *= 1.5; // Second place bonus
    else if (position === 3) xp *= 1.2; // Third place bonus

    // Difficulty bonus
    if (this.session.config.difficulty === 'hard') xp *= 1.5;
    else if (this.session.config.difficulty === 'medium') xp *= 1.2;

    return {
      xp: Math.floor(xp),
      bonus: position <= 3 ? 100 * (4 - position) : 0,
    };
  }

  protected abstract getBaseXpForGame(): number;

  public isFinished(): boolean {
    // Prefer authoritative subclass implementation
    if (this._isFinished !== BaseGame.prototype._isFinished) {
      return this._isFinished();
    }
    // Fallback: duck-type session.data flags for legacy games
    const data = this.session.data as Record<string, unknown>;
    return !!(
      data.gameOver ||
      data.finished ||
      data.solved ||
      data.drawn ||
      data.gamePhase === 'finished'
    );
  }

  /**
   * Override in subclasses to provide an authoritative finished check.
   * Default implementation is never called directly — isFinished() uses
   * duck-typing as fallback for legacy games that don't override this.
   */
  protected _isFinished(): boolean {
    const data = this.session.data as Record<string, unknown>;
    return !!(
      data.gameOver ||
      data.finished ||
      data.solved ||
      data.drawn ||
      data.gamePhase === 'finished'
    );
  }

  /**
   * Returns all Discord component rows for the current game state.
   * Default: duck-types the 8 legacy method names — existing games work unchanged.
   * New games override this and return rows directly.
   */
  public getComponents(): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
    const LEGACY_METHODS = [
      'getActionButtons',
      'getAnswerButtons',
      'getChoiceButtons',
      'getBoardButtons',
      'getMovementButtons',
      'getBetButtons',
      'getLetterButtons',
      'getNumberButtons',
    ] as const;
    const rows: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [];
    const self = this as unknown as Record<string, unknown>;
    for (const method of LEGACY_METHODS) {
      if (typeof self[method] === 'function') {
        const result = (
          self[
            method
          ] as () => ActionRowBuilder<MessageActionRowComponentBuilder>[]
        )();
        if (result?.length) rows.push(...result);
      }
    }
    return rows.slice(0, 5);
  }

  /**
   * Declares this game's button dispatch rules.
   * Default: [] — falls through to the legacy STATIC_BUTTONS/PREFIX_RULES.
   * New games override this; no edits to any handler file needed.
   */
  public getButtonDescriptors(): ButtonDescriptor[] {
    return [];
  }

  /**
   * Parses a modal submission into a game action.
   * Default: null — falls through to the legacy parseModalAction switch.
   * New games override this; no edits to any handler file needed.
   */
  public parseModal(
    _modalId: string,
    _value: string,
  ): Record<string, unknown> | null {
    return null;
  }
}

// Game Categories Configuration
export const GAME_CONFIGS: Record<GameType, GameConfig> = {
  [GameType.BLACKJACK]: { maxPlayers: 1, minPlayers: 1, timeLimit: 300 },
  [GameType.SLOTS]: { maxPlayers: 1, minPlayers: 1, timeLimit: 60 },
  [GameType.ROULETTE]: { maxPlayers: 6, minPlayers: 1, timeLimit: 120 },
  [GameType.DICE]: { maxPlayers: 4, minPlayers: 1, timeLimit: 180 },

  [GameType.TIC_TAC_TOE]: { maxPlayers: 2, minPlayers: 2, timeLimit: 180 },
  [GameType.ROCK_PAPER_SCISSORS]: {
    maxPlayers: 8,
    minPlayers: 2,
    timeLimit: 60,
  },
  [GameType.MAZE]: { maxPlayers: 1, minPlayers: 1, timeLimit: 300 },
};

export const GAME_COOLDOWNS: Record<GameType, number> = {
  [GameType.BLACKJACK]: 30,
  [GameType.SLOTS]: 15,
  [GameType.ROULETTE]: 120,
  [GameType.DICE]: 20,

  [GameType.TIC_TAC_TOE]: 20,
  [GameType.ROCK_PAPER_SCISSORS]: 15,
  [GameType.MAZE]: 120,
};
