import BotError from '@marquinhos/utils/botError';
import {
  EmbedBuilder,
  GuildMember,
  Message,
  MessageCreateOptions,
  MessagePayload,
  PermissionFlagsBits,
  PermissionResolvable,
  TextChannel,
  VoiceChannel,
} from 'discord.js';
import { sleep } from './sleep';

export interface BaseEmbedClient {
  user: { displayAvatarURL(): string } | null;
}

export function baseEmbed(client: BaseEmbedClient): EmbedBuilder {
  return new EmbedBuilder().setColor('#0099ff').setFooter({
    text: 'Marquinhos Bot ™️',
    iconURL: client.user?.displayAvatarURL(),
  });
}

export const checkPermissions = (
  member: GuildMember,
  permissions: Array<PermissionResolvable>,
) => {
  const neededPermissions: PermissionResolvable[] = [];
  permissions.forEach((permission) => {
    if (!member.permissions.has(permission)) neededPermissions.push(permission);
  });
  if (neededPermissions.length === 0) return null;
  return neededPermissions.map((p) => {
    if (typeof p === 'string') {
      return p.split(/(?=[A-Z])/).join(' ');
    } else {
      return Object.keys(PermissionFlagsBits)
        .find((k) => Object(PermissionFlagsBits)[k] === p)
        ?.split(/(?=[A-Z])/)
        .join(' ');
    }
  });
};

export const sendTimedMessage = async (
  message: string | MessagePayload | MessageCreateOptions,
  channel: TextChannel,
  duration: number,
): Promise<void> => {
  const sentMessage = await channel.send(message);
  await sleep(duration);
  try {
    await (await channel.messages.fetch(sentMessage)).delete();
  } catch (error: unknown) {
    throw new BotError((error as Error).message, sentMessage, 'warn');
  }
};

export const voiceChannelPresence = (message: Message): VoiceChannel | null => {
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
