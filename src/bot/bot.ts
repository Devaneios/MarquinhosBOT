import {
  Client,
  GatewayIntentBits,
  Collection,
  SlashCommandBuilder,
  REST,
  Routes,
  EmbedBuilder,
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
    this._client.baseEmbed = () =>
      new EmbedBuilder().setColor('#0099ff').setFooter({
        text: 'Marquinhos Bot ™️',
        iconURL: this._client.user?.displayAvatarURL(),
      });
  }

  async start() {
    this._loadTextCommands();
    this._loadSlashCommands();
    await this._sendSlashCommands();
    this._loadEvents();
    await this._startMongo();
    await this._client.login(process.env.MARQUINHOS_TOKEN);
  }

  private async _startMongo() {
    await mongoConnection();
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
          safeExecute(event.execute.bind(this, ...args))();
        });
      } else {
        this._client.on(event.name, (...args) => {
          safeExecute(event.execute.bind(this, ...args))();
        });
      }

      logger.info(`Successfully loaded event ${event.name}`);
    });
  }

  private async _sendSlashCommands() {
    const rest = new REST({ version: '10' }).setToken(
      process.env.MARQUINHOS_TOKEN as string
    );

    try {
      const data = (await rest.put(
        Routes.applicationCommands(process.env.MARQUINHOS_CLIENT_ID as string),
        {
          body: this._slashCommands.map((command) => command.toJSON()),
        }
      )) as SlashCommandBuilder[];

      if (!data?.length) {
        logger.warn('No slash commands loaded');
        return;
      }

      logger.info(`Successfully loaded ${data.length} slash command(s)`);
    } catch (error: any) {
      throw new Error(error);
    }
  }
}
