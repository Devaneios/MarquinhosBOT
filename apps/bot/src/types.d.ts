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

// Gamification Types
export interface UserLevel {
  userId: string;
  guildId: string;
  level: number;
  xp: number;
  totalXp: number;
  lastXpGain: Date | null;
}

// UserAchievement includes joined Achievement fields (flat response from backend JOIN)
export interface UserAchievement {
  userId: string;
  guildId: string;
  achievementId: string;
  unlockedAt: Date;
  name: string;
  description: string;
  category: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  icon: string;
  rewardXp: number;
}

export interface AddXpResult {
  userLevel: UserLevel;
  onCooldown: boolean;
  leveledUp: boolean;
  newLevel?: number;
  unlockedAchievements: string[];
}

// AI Chat Types
export type AiChatCategory =
  | 'general_question'
  | 'code_technical_question'
  | 'trick_riddle'
  | 'praise_thanks'
  | 'follow_up_on_bot'
  | 'opinion_reference'
  | 'bot_help_info'
  | 'user_roast_provocation'
  | 'casual_chat'
  | 'off_topic_unclear'
  | 'guardrail_roast'
  | 'agent_task';

export interface AiChatResponse {
  status: 'ok' | 'rate_limited' | 'error';
  category?: AiChatCategory;
  reply?: string;
  format?: 'embed' | 'text';
  embedTitle?: string;
  traceId?: string;
}

export interface EmojiReactionResponse {
  emojis: string[];
}

export interface ResearchSource {
  index: number;
  url: string;
  title: string;
  publishedDate?: string;
}

export interface ResearchStats {
  rounds: number;
  searches: number;
  fetched: number;
  relevantSources: number;
  maxDepth: number;
  durationMs: number;
  truncatedByBudget?: boolean;
}

export interface ResearchProgressEvent {
  seq: number;
  stage: string;
  message: string;
  createdAt: number;
}

export interface ResearchStartResponse {
  status: 'accepted' | 'rate_limited' | 'rejected';
  jobId?: string;
  created?: boolean;
  reply?: string;
}

export interface ResearchJobResponse {
  jobId: string;
  status: 'queued' | 'running' | 'done' | 'error';
  query: string;
  progress: ResearchProgressEvent[];
  report?: string;
  sources?: ResearchSource[];
  stats?: ResearchStats;
  error?: string;
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
