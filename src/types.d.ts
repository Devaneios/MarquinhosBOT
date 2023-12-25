import {
  AutocompleteInteraction,
  Collection,
  CommandInteraction,
  Message,
  PermissionResolvable,
  SlashCommandBuilder,
  TextChannel,
} from 'discord.js';
import { Subject } from 'rxjs';

export interface SlashCommand {
  command: SlashCommandBuilder | any;
  execute: (interaction: CommandInteraction) => void;
  autocomplete?: (interaction: AutocompleteInteraction) => void;
  cooldown?: number; // in seconds
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

interface IArrested extends mongoose.Document {
  id: string;
  user: string;
}

interface ISilenced extends mongoose.Document {
  id: string;
  user: string;
}

export interface IMinecraftServer extends mongoose.Document {
  guildID: string;
  channelID: string;
  messageID: string;
  host: string;
  port: number;
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

export interface IGuild extends mongoose.Document {
  guildID: string;
  roulette: Roulette;
  options: GuildOptions;
  joinedAt: Date;
}

export interface ITriviaQuestion extends mongoose.Document {
  question: string;
  answer: string;
  playersAnswered: string[];
  lastTimeAsked: Date;
  timesAsked: number;
  hints: string[];
  category: string;
  difficulty: string;
  createdAt: Date;
  updatedAt: Date;
}

export type TriviaPlayer = {
  id: string;
  points?: number;
  globalPoints?: number;
};

export interface ITriviaGame {
  players: TriviaPlayer[];
  category: string;
  difficulty: TriviaDifficulty;
  addQuestion(question: TriviaQuestion): Promise<TriviaQuestion>;
  removeQuestion(question: TriviaQuestion): any;
  getQuestion(questionId: string): any;
  getQuestions(category: string, page: number, pageSize: number): any;
  playerAnswer(answer: string, playerID: string): any;
  askQuestion(): any;
  endGame(): any;
}

export type TriviaCategory = 'general' | 'music' | 'movies' | 'games';

export type TriviaDifficulty = 'easy' | 'medium' | 'hard';

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
  messages: Subject<Message>;
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

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      TOKEN: string;
      CLIENT_ID: string;
      PREFIX: string;
    }
  }
}

declare module 'discord.js' {
  export interface Client {
    slashCommands: Collection<string, SlashCommand>;
    commands: Collection<string, Command>;
    cooldowns: Collection<string, number>;
    secretChannels: Collection<string, SecretChannelData>;
    triviaGames: Collection<string, TriviaGame>;
  }
}

declare module 'color-contrast' {
  export default function contrast(color1: string, color2: string): number;
}
