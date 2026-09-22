import BotError from '@marquinhos/utils/botError';
import { getErrorMessage } from '@marquinhos/utils/errorHandling';
import {
  APIInteractionDataResolvedGuildMember,
  APIInteractionGuildMember,
  Channel,
  ChannelType,
  CommandInteraction,
  EmbedBuilder,
  GuildMember,
  Message,
  MessageCreateOptions,
  MessagePayload,
  PermissionFlagsBits,
  PermissionResolvable,
  SendableChannels,
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
  channel: SendableChannels,
  duration: number,
): Promise<void> => {
  const sentMessage = await channel.send(message);
  await sleep(duration);
  try {
    await (await channel.messages.fetch(sentMessage)).delete();
  } catch (error: unknown) {
    throw new BotError(getErrorMessage(error), sentMessage, 'warn');
  }
};

export const voiceChannelPresence = (message: Message): VoiceChannel | null => {
  const channel = asVoiceChannel(message.member?.voice.channel);
  if (!channel) {
    message.reply('Você precisa estar em um canal de voz!');
    throw new BotError('User not in voice channel', message, 'warn');
  }
  return channel;
};

/**
 * Narrows `interaction.member`'s cached-or-not union down to a real
 * `GuildMember`, throwing a `BotError` for the null/API-shape branches
 * that mean the interaction wasn't resolved with a cached member.
 */
export function requireGuildMember(
  member: GuildMember | APIInteractionGuildMember | null,
  context: Message | CommandInteraction,
): GuildMember {
  const guildMember = resolveGuildMember(member);
  if (!guildMember) {
    throw new BotError('Membro não encontrado no servidor.', context, 'warn');
  }
  return guildMember;
}

/**
 * Non-throwing counterpart of `requireGuildMember`, for call sites (like
 * `interaction.options.getMember(...)`) where an unresolved member is an
 * expected, gracefully-handled outcome rather than an error.
 */
export function resolveGuildMember(
  member:
    | GuildMember
    | APIInteractionGuildMember
    | APIInteractionDataResolvedGuildMember
    | null,
): GuildMember | null {
  return member instanceof GuildMember ? member : null;
}

export function asTextChannel(
  channel: Channel | null | undefined,
): TextChannel | undefined {
  return channel?.type === ChannelType.GuildText ? channel : undefined;
}

export function asVoiceChannel(
  channel: Channel | null | undefined,
): VoiceChannel | undefined {
  return channel?.type === ChannelType.GuildVoice ? channel : undefined;
}

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
