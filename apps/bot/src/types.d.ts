export interface AvatarConfig {
  name: string;
  url: string;
  startDate: string | null;
  endDate: string | null;
}

export type BotErrorLogLevel = 'error' | 'warn' | 'info';

export type FlipCoinResult = {
  result: string;
  heads: number;
  tails: number;
  count: number;
  elapsedTime: number;
};
