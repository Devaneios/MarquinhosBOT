// API Response Types
export interface ApiResponse<T = unknown> {
  data: T;
  message?: string;
  error?: string;
}

export interface AvatarConfig {
  name: string;
  url: string;
  startDate: string | null;
  endDate: string | null;
}

export type BotErrorLogLevel = 'error' | 'warn' | 'info';

export type PlaybackData = {
  title: string;
  url?: string;
  listeningUsersId: string[];
  timestamp: Date;
  guildId: string;
  channelId: string;
  providerName: string;
};

export type FlipCoinResult = {
  result: string;
  heads: number;
  tails: number;
  count: number;
  elapsedTime: number;
};

export interface EmojiReactionResponse {
  emojis: string[];
}

// Maze Game Types
export interface MazeViewportState {
  sessionId: string;
  playerPosition: { x: number; y: number };
  /** 8×8 grid of cell types: 0=wall 1=path 2=player 3=exit 4=border 5=hidden */
  viewport: number[][];
  moves: number;
  isCompleted: boolean;
  isAbandoned?: boolean;
}
