import {
  GuildMember,
  MessageCreateOptions,
  MessagePayload,
  PermissionFlagsBits,
  PermissionResolvable,
  TextChannel,
  VoiceChannel,
} from 'discord.js';

import { SafeAny } from '@marquinhos/types';
import BotError from '@marquinhos/utils/botError';
import { sleep } from './sleep';

export const checkPermissions = (
  member: GuildMember,
  permissions: Array<PermissionResolvable>
) => {
  let neededPermissions: PermissionResolvable[] = [];
  permissions.forEach((permission) => {
    if (!member.permissions.has(permission)) neededPermissions.push(permission);
  });
  if (neededPermissions.length === 0) return null;
  return neededPermissions.map((p) => {
    if (typeof p === 'string') return p.split(/(?=[A-Z])/).join(' ');
    else
      return Object.keys(PermissionFlagsBits)
        .find((k) => Object(PermissionFlagsBits)[k] === p)
        ?.split(/(?=[A-Z])/)
        .join(' ');
  });
};

export const sendTimedMessage = async (
  message: string | MessagePayload | MessageCreateOptions,
  channel: TextChannel,
  duration: number
): Promise<void> => {
  const sentMessage = await channel.send(message);
  await sleep(duration);
  try {
    await (await channel.messages.fetch(sentMessage)).delete();
  } catch (error) {
    throw new BotError('Error deleting timed message', sentMessage, 'warn');
  }
};

export const voiceChannelPresence = (message: SafeAny): VoiceChannel | null => {
  const channel = message.member?.voice.channel as VoiceChannel;
  if (!channel) {
    message.reply('Você precisa estar em um canal de voz!');
    throw new BotError('User not in voice channel', message, 'warn');
  }
  return channel;
};

export enum AudioPlayerDisconnectEvent {
  Disconnect = 'disconnect',
}
