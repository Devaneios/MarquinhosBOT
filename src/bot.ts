import {
  Client,
  GatewayIntentBits,
  Collection,
  REST,
  Routes,
  SlashCommandBuilder,
  Message,
  EmbedBuilder,
} from 'discord.js';
import { BotEvent, Command, SecretChannelData, SlashCommand } from './types';
import { readdirSync } from 'fs';
import { join } from 'path';
import { logger } from './utils/logger';
import { safeExecute } from './utils/errorHandling';
import { playAudio, voiceChannelPresence } from './utils/discord';

const {
  Guilds,
  MessageContent,
  GuildMessages,
  GuildMembers,
  GuildVoiceStates,
} = GatewayIntentBits;

class Bot {
  private _client: Client;
  private readonly _slashCommandsDir = join(__dirname, './slashCommands');
  private readonly _commandsDir = join(__dirname, './commands/');
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
    readdirSync(this._slashCommandsDir).forEach((file) => {
      try {
        if (!file.endsWith('.js')) return;

        const command: SlashCommand =
          require(`${this._slashCommandsDir}/${file}`).default;
        this._slashCommands.push(command.command);
        this._client.slashCommands.set(command.command.name, command);

        logger.info(`Successfully read command ${command.command.name}`);
      } catch (error) {
        logger.error(`Error reading command ${file}`);
        logger.error(error);
      }
    });
  }

  private _loadTextCommands() {
    const commands: Command[] = [];

    readdirSync(this._commandsDir).forEach((file) => {
      try {
        if (!file.endsWith('.js')) return;
        let command: Command = require(`${this._commandsDir}/${file}`).default;
        commands.push(command);
        this._client.commands.set(command.name, command);
        logger.info(`Successfully read command ${command.name}`);
      } catch (error) {
        logger.error(`Error loading command ${file.replace('.js', '')}`);
        logger.error(error);
      }
    });
  }

  private _loadAudioCommands() {
    readdirSync(this._audiosDir).forEach((file) => {
      try {
        if (!file.endsWith('.mp3')) return;
        const command: Command = {
          name: file.replace('.mp3', ''),
          execute: (message: Message, args: string[]) => {
            const channel = voiceChannelPresence(message);
            playAudio(message, channel, file.replace('.mp3', ''));
          },
          cooldown: 10,
          aliases: [],
          permissions: [],
        };

        const slashCommand: SlashCommand = {
          command: new SlashCommandBuilder()
            .setName(file.replace('.mp3', ''))
            .setDescription(`Playing ${file.replace('.mp3', '')}`),
          execute: (interaction) => {
            const channel = voiceChannelPresence(interaction);
            playAudio(interaction, channel, file.replace('.mp3', ''));
            interaction.reply({
              embeds: [
                new EmbedBuilder().setDescription(
                  `Playing ${file.replace('.mp3', '')}`
                ),
              ],
            });
          },
          cooldown: 10,
        };
        this._slashCommands.push(slashCommand.command);
        this._client.commands.set(command.name, command);
        this._client.slashCommands.set(slashCommand.command.name, slashCommand);
        logger.info(`Successfully read command ${command.name}`);
      } catch (error) {
        logger.error(`Error loading command ${file.replace('.js', '')}`);
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
