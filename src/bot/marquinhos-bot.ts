import * as commands from '@marquinhos/bot/commands';
import * as events from '@marquinhos/bot/events';
import { SpreadsheetService } from '@marquinhos/services/spreadsheet';
import {
  BotEvent,
  Command,
  SecretChannelData,
  SlashCommand,
} from '@marquinhos/types';
import { sendTimedMessage } from '@marquinhos/utils/discord';
import { safeExecute } from '@marquinhos/utils/errorHandling';
import { logger } from '@marquinhos/utils/logger';
import { Scrobble } from '@marquinhos/utils/scrobble';
import { GuildQueue, Player, Track } from 'discord-player';
import {
  DeezerExtractor,
  DeezerExtractorOptions,
  NodeDecryptor,
} from 'discord-player-deezer';
import {
  Client,
  Collection,
  EmbedBuilder,
  GatewayIntentBits,
  GuildVoiceChannelResolvable,
  TextChannel,
  VoiceBasedChannel,
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
    await this._initializePlayer();
    SpreadsheetService.getInstance();
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

  private async _initializePlayer() {
    const player = new Player(this._client, {
      skipFFmpeg: true,
    });
    const timers: NodeJS.Timeout[] = [];

    const handlePlayStart = async (queue: GuildQueue, track: Track) => {
      const { interactionChannel, voiceChannel, addedBy } = queue.metadata as {
        interactionChannel: TextChannel;
        voiceChannel: VoiceBasedChannel;
        addedBy: string;
      };

      timers.forEach((timer) => clearTimeout(timer));

      const scrobble = new Scrobble();
      scrobble.create(voiceChannel, track).then(() => scrobble.queue());

      const fourMinutesInMillis = 240000;

      const timeUntilScrobbling = Math.min(
        Math.floor(track.durationMS / 2),
        fourMinutesInMillis
      );
      const dispatchTimer = setTimeout(() => {
        scrobble.dispatch();
      }, timeUntilScrobbling);

      timers.push(dispatchTimer);

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
    };

    player.events.on('playerStart', (queue: GuildQueue, track: Track) =>
      safeExecute(handlePlayStart.bind(this, queue, track))
    );

    player.events.on('playerError', (queue: GuildQueue, error: Error) => {
      logger.error(`Error in player: ${error.message}`);
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

    await player.extractors.register(DeezerExtractor, {
      decryptionKey: process.env.MARQUINHOS_DECRIPTION_KEY,
      arl: process.env.DEEZER_ARL_COOKIE,
      decryptor: NodeDecryptor,
    } as unknown as DeezerExtractorOptions);
  }
}
