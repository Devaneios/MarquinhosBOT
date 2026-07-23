import { GuildConfig } from '@marquinhos/config/guild';
import { MarquinhosApiService } from '@marquinhos/services/marquinhosApi';
import {
  ERROR_FALLBACK_POOL,
  LENGTH_GATE_POOL,
  RATE_LIMITED_MESSAGE,
} from './cannedPools';
import { isGreeting, pickGreeting } from './greeting';

const MAX_TAG_LENGTH = 2000;
const MAX_DISCORD_MESSAGE_LENGTH = 2000;

export interface TagResponseMessage {
  id: string;
  content: string;
  author: { id: string };
  guildId: string | null;
  channelId: string;
  client: { user: { id: string } | null };
  mentions: { has(userId: string): boolean };
  channel: {
    sendTyping(): Promise<unknown>;
    send(content: string): Promise<unknown>;
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
  reply(content: string): Promise<unknown>;
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

    const response = await apiService.respondToTag({
      userId: message.author.id,
      guildId: message.guildId,
      channelId: message.channelId,
      content: message.content
        .replace(new RegExp(`<@!?${botUserId}>`, 'g'), '')
        .trim(),
      recentMessages,
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

    const [firstChunk, ...extraChunks] = splitReply(result.reply);
    await message.reply(firstChunk);
    for (const chunk of extraChunks) {
      await message.channel.send(chunk);
    }
  } catch {
    await message.reply(pick(ERROR_FALLBACK_POOL));
  }
}
