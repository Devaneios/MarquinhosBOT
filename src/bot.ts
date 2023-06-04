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
  private client: Client;
  private readonly slashCommandsDir = join(__dirname, './slashCommands');
  private readonly commandsDir = join(__dirname, './commands/');
  private readonly audiosDir = join(__dirname, './resources/sounds/');
  private readonly eventsDir = join(__dirname, './events');
  private readonly slashCommands: SlashCommandBuilder[] = [];

  constructor() {
    this.client = new Client({
      intents: [
        Guilds,
        MessageContent,
        GuildMessages,
        GuildMembers,
        GuildVoiceStates,
      ],
    });
    this.client.slashCommands = new Collection<string, SlashCommand>();
    this.client.commands = new Collection<string, Command>();
    this.client.cooldowns = new Collection<string, number>();
    this.client.secretChannels = new Collection<string, SecretChannelData>();
  }

  loadSlashCommands() {
    readdirSync(this.slashCommandsDir).forEach((file) => {
      try {
        if (!file.endsWith('.js')) return;

        const command: SlashCommand =
          require(`${this.slashCommandsDir}/${file}`).default;
        this.slashCommands.push(command.command);
        this.client.slashCommands.set(command.command.name, command);

        logger.info(`Successfully read command ${command.command.name}`);
      } catch (error) {
        logger.error(`Error reading command ${file}`);
        logger.error(error);
      }
    });
  }

  loadTextCommands() {
    const commands: Command[] = [];

    readdirSync(this.commandsDir).forEach((file) => {
      try {
        if (!file.endsWith('.js')) return;
        let command: Command = require(`${this.commandsDir}/${file}`).default;
        commands.push(command);
        this.client.commands.set(command.name, command);
        logger.info(`Successfully read command ${command.name}`);
      } catch (error) {
        logger.error(`Error loading command ${file.replace('.js', '')}`);
        logger.error(error);
      }
    });
  }

  loadAudioCommands() {
    readdirSync(this.audiosDir).forEach((file) => {
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
        this.slashCommands.push(slashCommand.command);
        this.client.commands.set(command.name, command);
        this.client.slashCommands.set(slashCommand.command.name, slashCommand);
        logger.info(`Successfully read command ${command.name}`);
      } catch (error) {
        logger.error(`Error loading command ${file.replace('.js', '')}`);
        logger.error(error);
      }
    });
  }

  loadEvents() {
    readdirSync(this.eventsDir).forEach((file) => {
      if (!file.endsWith('.js')) return;
      let event: BotEvent = require(`${this.eventsDir}/${file}`).default;
      event.once
        ? this.client.once(event.name, (...args) => {
            safeExecute(event.execute, ...args)();
          })
        : this.client.on(event.name, (...args) => {
            safeExecute(event.execute, ...args)();
          });
      logger.info(`Successfully loaded event ${event.name}`);
    });
  }

  start() {
    this.client.login(process.env.TOKEN);
  }

  sendSlashCommands() {
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

    rest
      .put(Routes.applicationCommands(process.env.CLIENT_ID), {
        body: this.slashCommands.map((command) => command.toJSON()),
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
