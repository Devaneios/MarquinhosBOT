import { GuildConfig } from '@marquinhos/config/guild';
import { MarquinhosApiService } from '@marquinhos/services/marquinhosApi';
import {
  ERROR_FALLBACK_POOL,
  LENGTH_GATE_POOL,
  RATE_LIMITED_MESSAGE,
} from './cannedPools';
import { isGreeting, pickGreeting } from './greeting';

const MAX_TAG_LENGTH = 140;

export interface TagResponseMessage {
  content: string;
  author: { id: string };
  guildId: string | null;
  channelId: string;
  client: { user: { id: string } | null };
  mentions: { has(userId: string): boolean };
  channel: {
    sendTyping(): Promise<unknown>;
    messages: {
      fetch(options: {
        limit: number;
      }): Promise<
        Map<
          string,
          { author: { username: string; bot?: boolean }; content: string }
        >
      >;
    };
  };
  reply(content: string): Promise<unknown>;
}

function pick(pool: string[]): string {
  return pool[Math.floor(Math.random() * pool.length)];
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
  if (!message.mentions.has(message.client.user.id)) return;

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
      .filter((m) => !m.author.bot)
      .map((m) => ({ author: m.author.username, content: m.content }));

    const response = await apiService.respondToTag({
      userId: message.author.id,
      guildId: message.guildId,
      channelId: message.channelId,
      content: message.content,
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

    await message.reply(result.reply);
  } catch {
    await message.reply(pick(ERROR_FALLBACK_POOL));
  }
}
