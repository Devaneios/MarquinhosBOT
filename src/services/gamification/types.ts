export interface XpConfig {
  event_type: string;
  xp_amount: number;
  cooldown_ms: number | null;
}

export interface UserLevel {
  user_id: string;
  guild_id: string;
  level: number;
  xp: number;
  total_xp: number;
  last_xp_gain: number | null;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  category: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  icon: string;
  condition: string;
  reward_xp: number;
}

export interface UserAchievement {
  user_id: string;
  guild_id: string;
  achievement_id: string;
  unlocked_at: number;
  name: string;
  description: string;
  category: string;
  rarity: string;
  icon: string;
  reward_xp: number;
}

export interface UserStats {
  user_id: string;
  guild_id: string;
  total_commands: number;
  total_scrobbles: number;
  total_voice_joins: number;
  total_games: number;
  games_won: number;
}

export interface AddXpResult {
  userLevel: UserLevel;
  onCooldown: boolean;
  leveledUp: boolean;
  newLevel?: number;
  unlockedAchievements: string[];
}

export interface GameResultInput {
  sessionId: string;
  guildId: string;
  gameType: string;
  durationMs?: number;
  results: { userId: string; position: number }[];
}
