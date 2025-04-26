import {
  AutocompleteInteraction,
  Collection,
  CommandInteraction,
  Client as DiscordClient,
  Message,
  PermissionResolvable,
  SlashCommandBuilder,
  TextChannel,
} from 'discord.js';

export type Nullable<T> = T | null | undefined;

export interface SlashCommand {
  command: SlashCommandBuilder | any;
  execute: (interaction: CommandInteraction) => void;
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
  execute: (...args: any[]) => void;
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

export type SafeAny = any;

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
