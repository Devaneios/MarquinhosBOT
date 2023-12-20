import {
  Client,
  GatewayIntentBits,
  Collection,
  SlashCommandBuilder,
  REST,
  Routes,
} from 'discord.js';

import {
  BotEvent,
  Command,
  SecretChannelData,
  SlashCommand,
} from '@marquinhos/types';
import { logger } from '@utils/logger';
import { mongoConnection } from '@database/mongo';
import { safeExecute } from '@utils/errorHandling';
import MinecraftServerStatus from '@utils/minecraftServerStatus';
import * as commands from '@commands';
import * as events from '@events';

const {
  Guilds,
  MessageContent,
  GuildMessages,
  GuildMembers,
  GuildVoiceStates,
} = GatewayIntentBits;

export class Bot {
  private _client: Client;
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
    this._loadSlashCommands();
    this._sendSlashCommands();
    this._loadEvents();
    this._startMongo();
    this._startMinecraftServer();
    this._client.login(process.env.TOKEN);
  }

  private _startMongo() {
    mongoConnection();
  }

  private _startMinecraftServer() {
    const minecraftServer = MinecraftServerStatus.getInstance();
    minecraftServer.init(this._client);
    minecraftServer.start();
  }

  private _loadSlashCommands() {
    const slashCommands = Array.from(Object.values(commands.slashCommands)).map(
      (command) => command
    );

    slashCommands.forEach((command: SlashCommand) => {
      command.command.setName(
        `${command.command.name}${
          process.env.NODE_ENV === 'production' ? '' : '-dev'
        }`
      );
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

  private _loadEvents() {
    const eventsArray = Array.from(Object.values(events)).map(
      (event: BotEvent) => event
    );

    eventsArray.forEach((event: BotEvent) => {
      if (event.once) {
        this._client.once(event.name, (...args) => {
          safeExecute(event.execute, ...args)();
        });
      } else {
        this._client.on(event.name, (...args) => {
          safeExecute(event.execute, ...args)();
        });
      }

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
