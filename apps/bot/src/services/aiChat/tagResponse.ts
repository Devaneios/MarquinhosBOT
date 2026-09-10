import { isAiChannel } from '@marquinhos/config/developmentScope';
import { MarquinhosApiService } from '@marquinhos/services/marquinhosApi';
import { baseEmbed } from '@marquinhos/utils/discord';
import { logger } from '@marquinhos/utils/logger';
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
    isThread?(): boolean;
    parentId?: string | null;
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
  typingIntervalMs = 8000,
): Promise<void> {
  if (!isAiChannel(message)) return;
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

  const startedAt = Date.now();
  logger.info(
    `[ai-chat] tag recebida user=${message.author.id} channel=${message.channelId} chars=${message.content.length} replied=${Boolean(message.reference)}`,
  );

  try {
    await message.channel.sendTyping();
    // Discord's typing indicator expires after ~10s; an agent_task reply can
    // run a multi-iteration tool-calling loop well past that, so keep
    // re-triggering it for as long as we're waiting on the backend.
    const typingInterval = setInterval(() => {
      message.channel.sendTyping().catch(() => null);
    }, typingIntervalMs);

    try {
      await respondToTagAndReply(message, apiService, botUserId);
      logger.info(
        `[ai-chat] tag respondida user=${message.author.id} ${Date.now() - startedAt}ms`,
      );
    } finally {
      clearInterval(typingInterval);
    }
  } catch (error) {
    logger.error(
      `[ai-chat] tag falhou user=${message.author.id} ${Date.now() - startedAt}ms: ${(error as Error).message}\n${(error as Error).stack ?? ''}`,
    );
    await message.reply(pick(ERROR_FALLBACK_POOL));
  }
}

async function respondToTagAndReply(
  message: TagResponseMessage,
  apiService: Pick<MarquinhosApiService, 'respondToTag'>,
  botUserId: string,
): Promise<void> {
  if (!message.guildId) return;

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
    } catch (error) {
      logger.warn(
        `[ai-chat] não consegui buscar a mensagem referenciada: ${(error as Error).message}`,
      );
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
}
