import {
  SlashCommandBuilder,
  CommandInteraction,
  Collection,
  PermissionResolvable,
  Message,
  AutocompleteInteraction,
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

interface GuildOptions {
  prefix: string;
}

export interface IGuild {
  guildID: string;
  options: GuildOptions;
  joinedAt: Date;
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
  messages: Subject<Message>;
}

export type SafeAny = any;

export type BotErrorLogLevel = 'error' | 'warn' | 'info';

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
    VIP_ROLE_NAME: string;
    BASE_ROLE_NAME: string;
    EXTERNAL_ROLE_NAME: string;
  }
}
