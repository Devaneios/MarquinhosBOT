import { MarquinhosApiService } from '@marquinhos/services/marquinhosApi';
import { runThreadTurn, type AiThreadChannel } from './aiThread';

/**
 * Prefixes the /ia command puts on the threads it opens. Recognising a thread by
 * owner plus prefix keeps follow-ups free: no API round trip on every message in
 * the guild just to ask whether this channel is ours.
 */
export const AI_THREAD_PREFIXES = ['💭', '🔬'];
const MAX_FOLLOW_UP_LENGTH = 4000;

export interface AiThreadMessage {
  content: string;
  author: { id: string; bot?: boolean };
  guildId: string | null;
  client: { user: { id: string; displayAvatarURL(): string } | null };
  channel: AiThreadChannel & {
    isThread(): boolean;
    name?: string;
    ownerId?: string | null;
  };
}

export function isAiThread(
  channel: { isThread(): boolean; name?: string; ownerId?: string | null },
  botUserId: string,
): boolean {
  if (!channel.isThread()) return false;
  if (channel.ownerId !== botUserId) return false;
  const name = channel.name ?? '';
  return AI_THREAD_PREFIXES.some((prefix) => name.startsWith(prefix));
}

/**
 * Continues an /ia conversation when someone speaks in one of its threads — no
 * tag needed, since the thread itself is the scope of the conversation.
 *
 * Returns true when the message was handled, so the caller knows to skip the tag
 * flow for it.
 */
export async function handleAiThreadMessage(
  message: AiThreadMessage,
  apiService: Pick<
    MarquinhosApiService,
    'askInThread'
  > = MarquinhosApiService.getInstance(),
): Promise<boolean> {
  if (message.author.bot) return false;
  if (!message.guildId) return false;
  if (!message.client.user) return false;
  if (!isAiThread(message.channel, message.client.user.id)) return false;

  const content = message.content.trim();
  if (!content) return false;
  if (content.length > MAX_FOLLOW_UP_LENGTH) {
    await message.channel.send(
      'Resume aí, esse textão não cabe numa pergunta só.',
    );
    return true;
  }

  await runThreadTurn(message.channel, message.author.id, content, apiService);
  return true;
}
