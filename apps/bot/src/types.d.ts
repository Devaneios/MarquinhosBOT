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
