import {
  Client,
  Collection,
  EmbedBuilder,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
} from 'discord.js';

import * as commands from '@marquinhos/bot/commands';
import * as events from '@marquinhos/bot/events';
import {
  BotEvent,
  Command,
  SecretChannelData,
  SlashCommand,
} from '@marquinhos/types';
import { safeExecute } from '@marquinhos/utils/errorHandling';
import { logger } from '@marquinhos/utils/logger';

const {
  Guilds,
  MessageContent,
  GuildMessages,
  GuildMembers,
  GuildVoiceStates,
} = GatewayIntentBits;

export class MarquinhosBot {
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
    this._loadSlashCommands();
    await this._sendSlashCommands();
    this._loadEvents();
    await this._client.login(process.env.MARQUINHOS_TOKEN);
  }

  private _loadSlashCommands() {
    const slashCommands: SlashCommand[] = Object.values(commands);

    slashCommands
      .filter((command) => !command.disabled)
      .forEach((command: SlashCommand) => {
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
