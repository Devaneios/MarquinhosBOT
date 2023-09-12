import {
  ChannelType,
  Client,
  GuildMember,
  EmbedBuilder,
  Message,
  TextChannel,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { checkPermissions, sendTimedMessage } from '../utils/discord';
import { BotEvent, Track } from '../types';
import { logger } from '../utils/logger';
import BotError from '../utils/botError';
import FuzzySearch from 'fuzzy-search';
import { safeExecute } from '../utils/errorHandling';
import { TempoDataProvider } from '../services/tempo';
import dotenv from 'dotenv';
import { MarquinhosApiService } from '../services/marquinhosApi';
import SilencedModel from 'src/schemas/silenced';

const tempo = new TempoDataProvider();
const marquinhosApi = new MarquinhosApiService();

dotenv.config();

export const messageCreate: BotEvent = {
  name: 'messageCreate',
  execute: async (message: Message) => {
    const prefix = process.env.PREFIX;
    const timedMessageDuration = 10000;

    if (message.channel instanceof TextChannel && message.author.bot) {
      if (!tempo.isHandleableMessage(message)) return;
      const playbackData = await tempo.getPlaybackDataFromMessage(message);
      if (playbackData) {
        const response = await marquinhosApi.addToScrobbleQueue(playbackData);

        if (!response) {
          logger.info(`Couldn't add ${playbackData.title} to scrobble queue`);
          await message.channel.send({
            embeds: [
              new EmbedBuilder()
                .setTitle('Erro ao adicionar a fila de scrobbling')
                .setDescription(
                  `A música **${playbackData.title}** não foi adicionada a fila de scrobbling.`
                )
                .setColor('#FF0000'),
            ],
          });
          return;
        }

        const scrobbleId = response.data.id;
        const track: Track = response.data.track;
        let scrobblesOnUsers: string[] = response.data.scrobblesOnUsers;

        if (!scrobblesOnUsers || !track || !scrobbleId) {
          logger.info(`Couldn't add ${playbackData.title} to scrobble queue`);
          await message.channel.send({
            embeds: [
              new EmbedBuilder()
                .setTitle('Erro ao adicionar a fila de scrobbling')
                .setDescription(
                  `A música **${playbackData.title}** não foi adicionada a fila de scrobbling.`
                )
                .setColor('#FF0000'),
            ],
          });
          return;
        }

        logger.info(
          `Added ${playbackData.title} to scrobble queue to ${scrobblesOnUsers.length} users`
        );

        const fourMinutesInMillis = 240000;

        const timeUntilScrobbling = Math.min(
          Math.floor(track.durationInMillis / 2),
          fourMinutesInMillis
        );

        const cancelScrobble = new ButtonBuilder()
          .setCustomId('cancel')
          .setLabel('Cancelar')
          .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          cancelScrobble
        );

        const scrobbleEmbed = new EmbedBuilder()
          .setTitle('Adicionado a fila de scrobbling')
          .setDescription(
            `A música **${
              track.name
            }** foi adicionada a fila de scrobbling para os seguintes usuários:\n
        ${scrobblesOnUsers.map((id) => `<@${id}>`).join('\n')}
        `
          )
          .setThumbnail(track.coverArtUrl)
          .setFooter({
            text: `Scrobbling em ${new Date(timeUntilScrobbling).toLocaleString(
              'pt-BR',
              {
                timeZone: 'America/Sao_Paulo',
                minute: 'numeric',
                second: '2-digit',
              }
            )}`,
          })
          .setColor('#1DB954');

        const scrobbleEmbedRef = await message.channel.send({
          embeds: [scrobbleEmbed],
          components: [row],
        });

        let collector = scrobbleEmbedRef.createMessageComponentCollector();

        collector.on('collect', async (i) => {
          scrobblesOnUsers = scrobblesOnUsers.filter((id) => id !== i.user.id);
          await marquinhosApi.removeUserFromScrobbleQueue(
            scrobbleId,
            i.user.id
          );
          scrobbleEmbed.setDescription(
            `A música **${
              track.name
            }** foi adicionada a fila de scrobbling para os seguintes usuários:\n
        ${scrobblesOnUsers.map((id) => `<@${id}>`).join('\n')}
        `
          );
          await i.deferUpdate();
          await scrobbleEmbedRef.edit({
            embeds: [scrobbleEmbed],
            components: [row],
          });

          collector = scrobbleEmbedRef.createMessageComponentCollector();
        });

        setTimeout(() => {
          cancelScrobble.setDisabled(true);
          marquinhosApi.dispatchScrobbleQueue(scrobbleId);
        }, timeUntilScrobbling);
      }
    }
    if (!message.member) return;
    if (!message.guild) return;
    if (!message.content.startsWith(prefix)) {
      secretChannelMessageHandler(message);
      await silencedUserHandler(message);
      return;
    }

    if (message.channel.type !== ChannelType.GuildText) return;

    let args = message.content.substring(prefix.length).split(' ');
    let command = message.client.commands.get(args[0]);

    if (!command) {
      const commandList = message.client.commands;
      let commandFromAlias = commandList.find((command) =>
        command.aliases.includes(args[0])
      );
      if (commandFromAlias) command = commandFromAlias;
      else {
        const mapedCommands = commandList.map((command) => command.name);
        const searcher = new FuzzySearch(mapedCommands, undefined, {
          sort: true,
        });
        const result = searcher.search(args[0]);
        if (result.length > 0) {
          message.channel.send(`Você quis dizer: **${prefix}${result[0]}** ?`);
        }
        throw new BotError('Command not found', message, 'info');
      }
    }

    let cooldown = message.client.cooldowns.get(
      `${command.name}-${message.member.user.username}`
    );
    let neededPermissions = checkPermissions(
      message.member,
      command.permissions
    );
    if (neededPermissions !== null) {
      sendTimedMessage(
        `
            Você não tem permissão para usar esse comando. 
            \n Permissões necessárias: ${neededPermissions.join(', ')}
            `,
        message.channel,
        timedMessageDuration
      );
      throw new BotError(
        `${message.member?.user.username} missed permissions`,
        message,
        'warn'
      );
    }

    if (command.cooldown && cooldown) {
      if (Date.now() < cooldown) {
        sendTimedMessage(
          `Vai com calma! Você pode usar esse comando novamente daqui ${Math.floor(
            Math.abs(Date.now() - cooldown) / 1000
          )} segundos.`,
          message.channel,
          timedMessageDuration
        );
        throw new BotError(
          `${message.member?.user.username} exceed cooldown`,
          message,
          'warn'
        );
      }
      message.client.cooldowns.set(
        `${command.name}-${message.member.user.username}`,
        Date.now() + command.cooldown * 1000
      );
      setTimeout(() => {
        message.client.cooldowns.delete(
          `${command?.name}-${message.member?.user.username}`
        );
      }, command.cooldown * 1000);
    } else if (command.cooldown && !cooldown) {
      message.client.cooldowns.set(
        `${command.name}-${message.member.user.username}`,
        Date.now() + command.cooldown * 1000
      );
    }
    logger.info(
      `${message.member?.user.username} executing command: ${
        args ? args.join(' ') : ''
      }`
    );
    safeExecute(command.execute, message, args)();
  },
};

const secretChannelMessageHandler = (message: Message) => {
  const { secretChannels } = message.guild?.client as Client;
  const { id } = message.author;
  const secretChannel = secretChannels.get(id);
  if (secretChannel) {
    if (
      secretChannel.channel === message.channel &&
      secretChannel.finishesAt > new Date()
    ) {
      secretChannel.messages.next(message);
    }
  }
};

async function silencedUserHandler(message: Message) {
  if (await isUserSilenced(message.member as GuildMember)) {
    await message.delete();
    const channel = message.channel;
    sendTimedMessage('Silêncio.', channel as TextChannel, 1000);
  }
}

async function isUserSilenced(member: GuildMember) {
  return await SilencedModel.collection.findOne({
    id: member.id,
    user: member.user.username,
  });
}
