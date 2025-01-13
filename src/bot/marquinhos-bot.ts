import {
  AppleMusicExtractor,
  SpotifyExtractor,
} from '@discord-player/extractor';
import * as commands from '@marquinhos/bot/commands';
import * as events from '@marquinhos/bot/events';
import {
  BotEvent,
  Command,
  SecretChannelData,
  SlashCommand,
} from '@marquinhos/types';
import { sendTimedMessage } from '@marquinhos/utils/discord';
import { safeExecute } from '@marquinhos/utils/errorHandling';
import { logger } from '@marquinhos/utils/logger';
import { Player } from 'discord-player';
import { DeezerExtractor } from 'discord-player-deezer';
import {
  Client,
  Collection,
  EmbedBuilder,
  GatewayIntentBits,
  GuildVoiceChannelResolvable,
  REST,
  Routes,
  SlashCommandBuilder,
  TextChannel,
} from 'discord.js';

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
    this._loadEvents();
    await this._sendSlashCommands();
    await this._initializePlayer();
    await this._client.login(process.env.MARQUINHOS_TOKEN);
  }

  private _loadSlashCommands() {
    const slashCommands: SlashCommand[] = Object.values(commands);

    slashCommands
      .filter((slashCommand) => !slashCommand.disabled)
      .forEach((slashCommand: SlashCommand) => {
        slashCommand.command.setName(
          `${slashCommand.command.name}${
            process.env.NODE_ENV === 'production' ? '' : '-dev'
          }`
        );
        const commandName = slashCommand.command.name;
        try {
          this._slashCommands.push(slashCommand.command);
          this._client.slashCommands.set(commandName, slashCommand);
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

      logger.info(`Successfully deployed ${data.length} slash command(s)`);
    } catch (error: any) {
      throw new Error(error);
    }
  }

  private async _initializePlayer() {
    const player = new Player(this._client);

    player.events.on('playerStart', async (queue, track) => {
      const { interactionChannel, voiceChannel, addedBy } = queue.metadata as {
        interactionChannel: TextChannel;
        voiceChannel: GuildVoiceChannelResolvable;
        addedBy: string;
      };

      const playerEmbed = player.client
        .baseEmbed()
        .setTitle('Tocando agora')
        .setDescription(`[${track.title}](${track.url})`)
        .addFields(
          {
            name: 'Autor',
            value: track.author,
            inline: true,
          },
          {
            name: 'Duração',
            value: track.duration,
            inline: true,
          },
          {
            name: 'Adicionado por',
            value: `<@${addedBy}>`,
          }
        )
        .setThumbnail(track.thumbnail);

      sendTimedMessage(
        { embeds: [playerEmbed] },
        interactionChannel,
        track.durationMS
      );
    });

    player.events.on('audioTrackAdd', (queue, track) => {
      const { interactionChannel, voiceChannel, addedBy } = queue.metadata as {
        interactionChannel: TextChannel;
        voiceChannel: GuildVoiceChannelResolvable;
        addedBy: string;
      };

      if (queue.size > 0) {
        const playerEmbed = player.client
          .baseEmbed()
          .setTitle('Adicionada a fila')
          .setDescription(`[${track.title}](${track.url})`)
          .addFields(
            {
              name: 'Autor',
              value: track.author,
              inline: true,
            },
            {
              name: 'Duração',
              value: track.duration,
              inline: true,
            },
            {
              name: 'Adicionado por',
              value: `<@${addedBy}>`,
            }
          )
          .setThumbnail(track.thumbnail);

        interactionChannel.send({
          embeds: [playerEmbed],
        });
      }
    });

    await player.extractors.register(SpotifyExtractor, {});
    await player.extractors.register(AppleMusicExtractor, {});
    await player.extractors.register(DeezerExtractor, {
      decryptionKey: process.env.MARQUINHOS_DECRIPTION_KEY,
    });
  }
}
