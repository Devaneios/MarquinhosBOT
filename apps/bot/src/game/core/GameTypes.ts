import {
  ActionRowBuilder,
  EmbedBuilder,
  Message,
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
  message?: Message; // Discord message displaying this session, attached after the initial reply
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

export abstract class BaseGame<
  TData,
  TAction extends Record<string, unknown> = Record<string, unknown>,
> {
  protected session: GameSession;

  constructor(session: GameSession) {
    this.session = session;
  }

  // The heterogeneous Collection<string, GameSession> holds every game type under one
  // key with no runtime tag to discriminate on, so recovering the per-instance shape at
  // this boundary requires exactly one cast — this is the sanctioned exception.
  protected get data(): TData {
    return this.session.data as TData;
  }

  protected set data(value: TData) {
    this.session.data = value;
  }

  abstract start(): Promise<void>;
  abstract handlePlayerAction(userId: string, action: TAction): Promise<void>;
  abstract getGameEmbed(): EmbedBuilder;
  abstract finish(): Promise<GameResult>;

  protected getActionButtons?(): ActionRowBuilder<MessageActionRowComponentBuilder>[];
  protected getAnswerButtons?(): ActionRowBuilder<MessageActionRowComponentBuilder>[];
  protected getChoiceButtons?(): ActionRowBuilder<MessageActionRowComponentBuilder>[];
  protected getBoardButtons?(): ActionRowBuilder<MessageActionRowComponentBuilder>[];
  protected getMovementButtons?(): ActionRowBuilder<MessageActionRowComponentBuilder>[];
  protected getBetButtons?(): ActionRowBuilder<MessageActionRowComponentBuilder>[];
  protected getLetterButtons?(): ActionRowBuilder<MessageActionRowComponentBuilder>[];
  protected getNumberButtons?(): ActionRowBuilder<MessageActionRowComponentBuilder>[];

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
    return BaseGame.duckTypeFinished(this.session.data);
  }

  /**
   * Override in subclasses to provide an authoritative finished check.
   * Default implementation is never called directly — isFinished() uses
   * duck-typing as fallback for legacy games that don't override this.
   */
  protected _isFinished(): boolean {
    return BaseGame.duckTypeFinished(this.session.data);
  }

  private static duckTypeFinished(data: unknown): boolean {
    if (!data || typeof data !== 'object') return false;
    return !!(
      ('gameOver' in data && data.gameOver) ||
      ('finished' in data && data.finished) ||
      ('solved' in data && data.solved) ||
      ('drawn' in data && data.drawn) ||
      ('gamePhase' in data && data.gamePhase === 'finished')
    );
  }

  /**
   * Returns all Discord component rows for the current game state.
   * Default: calls the optional legacy method hooks — existing games work unchanged.
   * New games override this and return rows directly.
   */
  public getComponents(): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
    const LEGACY_METHODS = [
      this.getActionButtons,
      this.getAnswerButtons,
      this.getChoiceButtons,
      this.getBoardButtons,
      this.getMovementButtons,
      this.getBetButtons,
      this.getLetterButtons,
      this.getNumberButtons,
    ] as const;
    const rows: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [];
    for (const method of LEGACY_METHODS) {
      const result = method?.call(this);
      if (result?.length) rows.push(...result);
    }
    return rows.slice(0, 5);
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

export const BET_RANGE = { min: 5, max: 100 } as const;
