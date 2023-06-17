import {
  Collection,
  GuildBasedChannel,
  Message,
  TextChannel,
} from 'discord.js';
import { Command } from '../../types';
import { sendTimedMessage } from '../../utils/discord';
import BotError from '../../utils/botError';

export const anom: Command = {
  name: 'anom',
  execute: (message: Message, args: string[]) => {
    const incommingChannel = message.channel as TextChannel;
    const channelName = args[1];
    const channels = message.guild?.channels.cache;
    if (channelNotProvided(channelName, incommingChannel)) {
      throw new BotError('Channel not specified', message, 'warn');
    }

    const parsedMessage = messageHandler(args);

    const desiredChannel = searchChannel(
      channelName,
      channels,
      incommingChannel
    );

    if (desiredChannel) {
      (desiredChannel as TextChannel).send(`Alguém disse: ${parsedMessage}`);
    } else {
      throw new BotError(`Channel ${channelName} not found`, message, 'warn');
    }
  },
  cooldown: 10,
  aliases: ['anonimo'],
  permissions: [],
};

const messageHandler = (args: string[]) => {
  return args.slice(2).join(' ');
};

const channelNotProvided = (
  channelName: string,
  incommingChanel: TextChannel
): boolean => {
  if (!channelName) {
    sendTimedMessage(
      'Você precisa especificar um canal!',
      incommingChanel,
      5000
    );
    return true;
  }
  return false;
};

const searchChannel = (
  channelName: string,
  channels: Collection<string, GuildBasedChannel> | undefined,
  incommingChannel: TextChannel
) => {
  if (!channels) return null;
  const desiredChannel = channels
    .filter((channel) => channel.name === channelName)
    .first();
  if (desiredChannel) return desiredChannel;
  sendTimedMessage(
    'Desculpe, não consegui achar esse canal! :(',
    incommingChannel,
    5000
  );
  return null;
};
