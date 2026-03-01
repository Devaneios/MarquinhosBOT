import {
  AutocompleteInteraction,
  Collection,
  CommandInteraction,
  Client as DiscordClient,
  Interaction,
  Message,
  PermissionResolvable,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  TextChannel,
  EmbedBuilder,
  SlashCommandSubcommandsOnlyBuilder,
  SlashCommandOptionsOnlyBuilder,
} from 'discord.js';

export type Nullable<T> = T | null | undefined;

// API Response Types
export interface ApiResponse<T = unknown> {
  data: T;
  message?: string;
  error?: string;
}

export interface ApiError extends Error {
  response?: {
    status?: number;
    data?: unknown;
  };
  config?: {
    url?: string;
  };
}

export interface SlashCommand {
  command:
    | SlashCommandBuilder
    | SlashCommandSubcommandsOnlyBuilder
    | SlashCommandOptionsOnlyBuilder
    | Omit<SlashCommandBuilder, 'addSubcommandGroup' | 'addSubcommand'>
    | Omit<
        SlashCommandBuilder,
        | 'addBooleanOption'
        | 'addUserOption'
        | 'addChannelOption'
        | 'addRoleOption'
        | 'addStringOption'
        | 'addNumberOption'
        | 'addIntegerOption'
        | 'addAttachmentOption'
        | 'addMentionableOption'
      >;
  execute: (interaction: ChatInputCommandInteraction) => Promise<any> | void;
  validators?: ((interaction: CommandInteraction) => Promise<boolean>)[];
  autocomplete?: (interaction: AutocompleteInteraction) => void;
  cooldown?: number; // in seconds
  disabled?: boolean;
}

export interface Command {
  name: string;
  execute: (message: Message, args: Array<string>) => void;
  permissions: Array<PermissionResolvable>;
  aliases: Array<string>;
  cooldown?: number;
}

export interface AudioCommandBuilder {
  slashCommand: SlashCommand;
  textCommand: Command;
}

interface GuildOptions {
  prefix: string;
  vipRoleId: string;
  baseRoleId: string;
  externalRoleId: string;
  rouletteRoleId: string;
  newcomersChannelId: string;
  mainChannelId: string;
  joinedAt: Date;
}

interface Roulette {
  isRouletteOn: boolean;
  rouletteAdmins: string[];
}

export type GuildOption = keyof GuildOptions;
export interface BotEvent {
  name: string;
  once?: boolean | false;
  execute: (...args) => void;
}

export interface SecretChannelData {
  channel: TextChannel;
  startedAt: Date;
  finishesAt: Date;
}

export interface BufferedMessage {
  messageId: string;
  userId: string;
  channelId: string;
  hash: string;
  timestamp: number;
  deleted: boolean;
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

export type Track = {
  artist: string;
  name: string;
  durationInMillis: number;
  album?: string;
  coverArtUrl?: string;
};

export type LastfmTopListenedPeriod =
  | '7day'
  | '1month'
  | '3month'
  | '6month'
  | '12month'
  | 'overall';

export type BalanceOperationType = 'add' | 'subtract' | 'set' | 'reset';

export type BalanceChangeStatus = {
  operationSuccess: boolean;
  statementCreated: boolean;
  validAmount: boolean;
};

export type FlipCoinResult = {
  result: string;
  heads: number;
  tails: number;
  count: number;
  elapsedTime: number;
};

export type RolesConfig = {
  externalRoleId: Nullable<string>;
  baseRoleId: Nullable<string>;
  vipRoleId: Nullable<string>;
};

// Gamification Types
export interface UserLevel {
  userId: string;
  guildId: string;
  level: number;
  xp: number;
  totalXp: number;
  lastXpGain: Date;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  category: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  icon: string;
  condition: any;
  reward?: {
    xp?: number;
    role?: string;
    badge?: string;
  };
}

export interface UserAchievement {
  userId: string;
  achievementId: string;
  unlockedAt: Date;
  guildId: string;
}

// Music System Types
export interface Playlist {
  id: string;
  name: string;
  description?: string;
  creatorId: string;
  guildId: string;
  isCollaborative: boolean;
  tracks: PlaylistTrack[];
  followers: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PlaylistTrack {
  title: string;
  artist: string;
  url: string;
  addedBy: string;
  addedAt: Date;
  votes: number;
  voters: string[];
}

export interface MusicRecommendation {
  userId: string;
  trackTitle: string;
  artist: string;
  score: number;
  reason: string;
  createdAt: Date;
}

export interface KaraokeSession {
  id: string;
  guildId: string;
  channelId: string;
  hostId: string;
  currentTrack?: {
    title: string;
    artist: string;
    lyrics: string[];
    duration: number;
  };
  participants: string[];
  scores: Record<string, number>;
  isActive: boolean;
  createdAt: Date;
}

// Social System Types
export interface MusicGroup {
  id: string;
  name: string;
  description: string;
  guildId: string;
  creatorId: string;
  members: string[];
  genre?: string;
  isPrivate: boolean;
  createdAt: Date;
}

export interface ListeningParty {
  id: string;
  name: string;
  description: string;
  guildId: string;
  channelId: string;
  hostId: string;
  scheduledAt: Date;
  duration: number;
  playlist?: string;
  participants: string[];
  isActive: boolean;
  createdAt: Date;
}

// Analytics Types
export interface UserStats {
  userId: string;
  guildId: string;
  totalCommands: number;
  totalVoiceTime: number;
  totalScrobbles: number;
  favoriteGenres: string[];
  listeningPatterns: Record<string, number>;
  lastUpdated: Date;
}

export interface ServerReport {
  guildId: string;
  period: string;
  totalUsers: number;
  activeUsers: number;
  totalCommands: number;
  topTracks: any[];
  topArtists: any[];
  generatedAt: Date;
}

// Premium System Types
export interface PremiumSubscription {
  userId: string;
  plan: 'basic' | 'premium' | 'lifetime';
  startDate: Date;
  endDate?: Date;
  isActive: boolean;
  features: string[];
}

// Plugin System Types
export interface Plugin {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  enabled: boolean;
  config: any;
}

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      MARQUINHOS_TOKEN: string;
      MARQUINHOS_CLIENT_ID: string;
      MARQUINHOS_PREFIX: string;
    }
  }
}

declare module 'discord.js' {
  export interface Client extends DiscordClient {
    slashCommands: Collection<string, SlashCommand>;
    commands: Collection<string, Command>;
    cooldowns: Collection<string, number>;
    secretChannels: Collection<string, SecretChannelData>;
    baseEmbed: () => EmbedBuilder;
  }
}

declare module 'color-contrast' {
  export default function contrast(color1: string, color2: string): number;
}
