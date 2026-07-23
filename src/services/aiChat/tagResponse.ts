import { GuildConfig } from '@marquinhos/config/guild';
import { MarquinhosApiService } from '@marquinhos/services/marquinhosApi';
import { baseEmbed } from '@marquinhos/utils/discord';
import type { EmbedBuilder } from 'discord.js';
import {
  ERROR_FALLBACK_POOL,
  LENGTH_GATE_POOL,
  RATE_LIMITED_MESSAGE,
} from './cannedPools';
import { isGreeting, pickGreeting } from './greeting';

const MAX_TAG_LENGTH = 2000;
const MAX_DISCORD_MESSAGE_LENGTH = 2000;
const MAX_EMBED_DESCRIPTION_LENGTH = 4096;
const DEFAULT_EMBED_TITLE = '💭 Resposta';

type TagResponsePayload = string | { embeds: EmbedBuilder[] };

export interface TagResponseMessage {
  id: string;
  content: string;
  author: { id: string };
  guildId: string | null;
  channelId: string;
  client: {
    user: { id: string; displayAvatarURL(): string } | null;
  };
  mentions: { has(userId: string): boolean };
  reference: { messageId?: string } | null;
  fetchReference(): Promise<{
    author: { id: string; username: string; bot?: boolean };
    content: string;
  }>;
  channel: {
    sendTyping(): Promise<unknown>;
    send(content: TagResponsePayload): Promise<unknown>;
    messages: {
      fetch(options: { limit: number }): Promise<
        Map<
          string,
          {
            id: string;
            author: { id: string; username: string; bot?: boolean };
            content: string;
          }
        >
      >;
    };
  };
  reply(content: TagResponsePayload): Promise<unknown>;
}

function pick(pool: string[]): string {
  return pool[Math.floor(Math.random() * pool.length)];
}

function splitReply(text: string): string[] {
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > MAX_DISCORD_MESSAGE_LENGTH) {
    let cut = rest.lastIndexOf('\n', MAX_DISCORD_MESSAGE_LENGTH);
    if (cut <= 0) cut = MAX_DISCORD_MESSAGE_LENGTH;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut).trimStart();
  }
  chunks.push(rest);
  return chunks;
}

export async function handleTagResponse(
  message: TagResponseMessage,
  apiService: Pick<
    MarquinhosApiService,
    'respondToTag'
  > = MarquinhosApiService.getInstance(),
): Promise<void> {
  if (message.channelId !== GuildConfig.DEVANEIOS_CHANNEL_ID) return;
  if (!message.guildId) return;
  if (!message.client.user) return;
  const botUserId = message.client.user.id;
  if (!message.mentions.has(botUserId)) return;

  if (isGreeting(message.content)) {
    await message.reply(pickGreeting());
    return;
  }

  if (message.content.length > MAX_TAG_LENGTH) {
    await message.reply(pick(LENGTH_GATE_POOL));
    return;
  }

  try {
    await message.channel.sendTyping();

    const recentMessagesCollection = await message.channel.messages.fetch({
      limit: 20,
    });
    const recentMessages = Array.from(recentMessagesCollection.values())
      .reverse()
      .filter((m) => m.id !== message.id)
      .filter((m) => !m.author.bot || m.author.id === botUserId)
      .map((m) => ({
        author: m.author.id === botUserId ? 'você (bot)' : m.author.username,
        content: m.content,
      }));

    let repliedMessage: { author: string; content: string } | undefined;
    if (message.reference) {
      try {
        const referencedMessage = await message.fetchReference();
        repliedMessage = {
          author:
            referencedMessage.author.id === botUserId
              ? 'você (bot)'
              : referencedMessage.author.username,
          content: referencedMessage.content,
        };
      } catch {
        repliedMessage = undefined;
      }
    }

    const response = await apiService.respondToTag({
      userId: message.author.id,
      guildId: message.guildId,
      channelId: message.channelId,
      content: message.content
        .replace(new RegExp(`<@!?${botUserId}>`, 'g'), '')
        .trim(),
      recentMessages,
      repliedMessage,
    });

    const result = response.data;

    if (result.status === 'rate_limited') {
      await message.reply(RATE_LIMITED_MESSAGE);
      return;
    }

    if (result.status === 'error' || !result.reply) {
      await message.reply(pick(ERROR_FALLBACK_POOL));
      return;
    }

    if (
      result.format === 'embed' &&
      result.reply.length <= MAX_EMBED_DESCRIPTION_LENGTH
    ) {
      const embed = baseEmbed(message.client)
        .setTitle(result.embedTitle ?? DEFAULT_EMBED_TITLE)
        .setDescription(result.reply);
      await message.reply({ embeds: [embed] });
      return;
    }

    const [firstChunk, ...extraChunks] = splitReply(result.reply);
    await message.reply(firstChunk);
    for (const chunk of extraChunks) {
      await message.channel.send(chunk);
    }
  } catch {
    await message.reply(pick(ERROR_FALLBACK_POOL));
  }
}
