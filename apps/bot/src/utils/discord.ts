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

export const MAX_DISCORD_MESSAGE_LENGTH = 2000;
export const MAX_EMBED_DESCRIPTION_LENGTH = 4096;

/**
 * Splits text into Discord-sized chunks, preferring to break on a blank line,
 * then a line break, then a space, so a long AI answer or research report does
 * not get cut mid-word or mid-code-fence.
 */
export function splitMessage(
  text: string,
  limit: number = MAX_DISCORD_MESSAGE_LENGTH,
): string[] {
  const chunks: string[] = [];
  let rest = text;

  while (rest.length > limit) {
    const window = rest.slice(0, limit);
    let cut = window.lastIndexOf('\n\n');
    if (cut <= 0) cut = window.lastIndexOf('\n');
    if (cut <= 0) cut = window.lastIndexOf(' ');
    if (cut <= 0) cut = limit;
    chunks.push(rest.slice(0, cut).trimEnd());
    rest = rest.slice(cut).trimStart();
  }

  if (rest.length > 0) chunks.push(rest);
  return chunks.length > 0 ? chunks : [''];
}

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

export async function fetchAvatarBuffer(
  member: GuildMember,
): Promise<Buffer | undefined> {
  try {
    const url = member.displayAvatarURL({ extension: 'png', size: 128 });
    const res = await fetch(url);
    if (!res.ok) return undefined;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return undefined;
  }
}
