import {
  Client,
  GatewayIntentBits,
  Collection,
  REST,
  Routes,
  SlashCommandBuilder,
} from 'discord.js';
import { BotEvent, Command, SecretChannelData, SlashCommand } from './types';
import { readdirSync } from 'fs';
import { join } from 'path';
import { logger } from './utils/logger';
import { safeExecute } from './utils/errorHandling';
import { audioCommandBuilder } from './commands/audioCommands/audioCommandBuilder';
import * as commands from './commands';

const {
  Guilds,
  MessageContent,
  GuildMessages,
  GuildMembers,
  GuildVoiceStates,
} = GatewayIntentBits;

class Bot {
  private _client: Client;
  private readonly _audiosDir = join(__dirname, './resources/sounds/');
  private readonly _eventsDir = join(__dirname, './events');
  private readonly _slashCommands: SlashCommandBuilder[] = [];

  constructor() {
    this._client = new Client({
      intents: [
        Guilds,
        MessageContent,
        GuildMessages,
        GuildMembers,
        GuildVoiceStates,
      ],
    });
    this._client.slashCommands = new Collection<string, SlashCommand>();
    this._client.commands = new Collection<string, Command>();
    this._client.cooldowns = new Collection<string, number>();
    this._client.secretChannels = new Collection<string, SecretChannelData>();
  }

  start() {
    this._loadTextCommands();
    this._loadAudioCommands();
    this._loadSlashCommands();
    this._sendSlashCommands();
    this._loadEvents();
    this._client.login(process.env.TOKEN);
  }

  private _loadSlashCommands() {
    const slashCommands = Array.from(Object.values(commands.slashCommands)).map(
      (command) => command
    );

    slashCommands.forEach((command: SlashCommand) => {
      const commandName = command.command.name;
      try {
        this._slashCommands.push(command.command);
        this._client.slashCommands.set(commandName, command);
        logger.info(`Successfully loaded slash command ${commandName}`);
      } catch (error) {
        logger.error(`Error loading slash command ${commandName}`);
        logger.error(error);
      }
    });
  }

  private _loadTextCommands() {
    const textCommands = Array.from(Object.values(commands.textCommands)).map(
      (command: Command) => command
    );
    textCommands.forEach((command) => {
      const commandName = command.name;
      try {
        this._client.commands.set(commandName as string, command);
        logger.info(`Successfully loaded text command ${commandName}`);
      } catch (error) {
        logger.error(`Error loading text command ${commandName}`);
        logger.error(error);
      }
    });
  }

  private _loadAudioCommands() {
    readdirSync(this._audiosDir).forEach((file) => {
      try {
        if (!file.endsWith('.mp3') || file.startsWith('_')) return;
        const { slashCommand, textCommand } = audioCommandBuilder(file);

        this._slashCommands.push(slashCommand.command);
        this._client.commands.set(textCommand.name, textCommand);
        this._client.slashCommands.set(slashCommand.command.name, slashCommand);
        logger.info(`Successfully loaded audio command ${textCommand.name}`);
      } catch (error) {
        logger.error(`Error loading audio command ${file.replace('.js', '')}`);
        logger.error(error);
      }
    });
  }

  private _loadEvents() {
    readdirSync(this._eventsDir).forEach((file) => {
      if (!file.endsWith('.js')) return;
      let event: BotEvent = require(`${this._eventsDir}/${file}`).default;
      event.once
        ? this._client.once(event.name, (...args) => {
            safeExecute(event.execute, ...args)();
          })
        : this._client.on(event.name, (...args) => {
            safeExecute(event.execute, ...args)();
          });
      logger.info(`Successfully loaded event ${event.name}`);
    });
  }

  private _sendSlashCommands() {
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

    rest
      .put(Routes.applicationCommands(process.env.CLIENT_ID), {
        body: this._slashCommands.map((command) => command.toJSON()),
      })
      .then((data: any) => {
        if (!data.length) {
          logger.warn('No slash commands loaded');
          return;
        }
        logger.info(`Successfully loaded ${data.length} slash command(s)`);
      })
      .catch((e) => {
        logger.error('Error loading slash commands');
        logger.error(e);
      });
  }
}

export default Bot;
