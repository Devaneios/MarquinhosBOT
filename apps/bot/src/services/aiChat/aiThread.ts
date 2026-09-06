import { MarquinhosApiService } from '@marquinhos/services/marquinhosApi';
import {
  baseEmbed,
  MAX_EMBED_DESCRIPTION_LENGTH,
  splitMessage,
} from '@marquinhos/utils/discord';
import { logger } from '@marquinhos/utils/logger';
import type { EmbedBuilder } from 'discord.js';
import { ERROR_FALLBACK_POOL, RATE_LIMITED_MESSAGE } from './cannedPools';

const DEFAULT_EMBED_TITLE = '🧵 Resposta';
export const THREAD_NAME_MAX_CHARS = 90;
const TYPING_INTERVAL_MS = 8000;

export type ThreadSendPayload = string | { embeds: EmbedBuilder[] };

/**
 * The slice of a Discord ThreadChannel this module needs. Narrowed on purpose so
 * the behaviour is testable without standing up a gateway client.
 */
export interface AiThreadChannel {
  id: string;
  guildId: string | null;
  parentId: string | null;
  sendTyping(): Promise<unknown>;
  send(payload: ThreadSendPayload): Promise<unknown>;
  client: { user: { displayAvatarURL(): string } | null };
}

function pick(pool: string[]): string {
  return pool[Math.floor(Math.random() * pool.length)]!;
}

/** Discord caps thread names at 100 chars; keep room and never cut mid-word. */
export function buildThreadName(prefix: string, question: string): string {
  const clean = question.replace(/\s+/g, ' ').trim();
  if (clean.length <= THREAD_NAME_MAX_CHARS) return `${prefix} ${clean}`;
  const window = clean.slice(0, THREAD_NAME_MAX_CHARS);
  const cut = window.lastIndexOf(' ');
  return `${prefix} ${(cut > 40 ? window.slice(0, cut) : window).trimEnd()}…`;
}

/**
 * Posts a reply into a thread, as an embed when it is long and structured, and
 * split across messages when it is longer than one Discord message allows.
 */
export async function sendThreadReply(
  thread: AiThreadChannel,
  reply: string,
  options: { format?: 'embed' | 'text'; embedTitle?: string } = {},
): Promise<void> {
  if (
    options.format === 'embed' &&
    reply.length <= MAX_EMBED_DESCRIPTION_LENGTH
  ) {
    const embed = baseEmbed(thread.client)
      .setTitle(options.embedTitle ?? DEFAULT_EMBED_TITLE)
      .setDescription(reply);
    await thread.send({ embeds: [embed] });
    return;
  }

  for (const chunk of splitMessage(reply)) {
    if (chunk.trim().length === 0) continue;
    await thread.send(chunk);
  }
}

/**
 * Runs one turn of an /ia perguntar conversation: keeps the typing indicator
 * alive while the API works (an agentic turn easily outlives Discord's ~10s
 * typing window) and posts whatever comes back.
 */
export async function runThreadTurn(
  thread: AiThreadChannel,
  userId: string,
  content: string,
  apiService: Pick<
    MarquinhosApiService,
    'askInThread'
  > = MarquinhosApiService.getInstance(),
  typingIntervalMs = TYPING_INTERVAL_MS,
): Promise<void> {
  if (!thread.guildId) return;

  const startedAt = Date.now();
  await thread.sendTyping().catch(() => null);
  const typing = setInterval(() => {
    thread.sendTyping().catch(() => null);
  }, typingIntervalMs);

  try {
    const response = await apiService.askInThread({
      threadId: thread.id,
      guildId: thread.guildId,
      channelId: thread.parentId ?? thread.id,
      userId,
      content,
    });

    const result = response.data;

    if (result.status === 'rate_limited') {
      await thread.send(RATE_LIMITED_MESSAGE);
      return;
    }
    if (result.status === 'error' || !result.reply) {
      await thread.send(pick(ERROR_FALLBACK_POOL));
      return;
    }

    await sendThreadReply(thread, result.reply, {
      format: result.format,
      embedTitle: result.embedTitle,
    });

    logger.info(
      `[ai-chat] thread turn ok thread=${thread.id} user=${userId} ${Date.now() - startedAt}ms`,
    );
  } catch (error) {
    logger.error(
      `[ai-chat] thread turn falhou thread=${thread.id} user=${userId}: ${(error as Error).message}`,
    );
    await thread.send(pick(ERROR_FALLBACK_POOL)).catch(() => null);
  } finally {
    clearInterval(typing);
  }
}
