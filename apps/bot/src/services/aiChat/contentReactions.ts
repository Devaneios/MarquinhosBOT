import { isAiChannel } from '@marquinhos/config/developmentScope';
import { MarquinhosApiService } from '@marquinhos/services/marquinhosApi';
import { logger } from '@marquinhos/utils/logger';

export interface ContentReactionMessage {
  guildId?: string | null;
  channel?: { isThread?(): boolean; parentId?: string | null };
  content: string;
  channelId: string;
  react(emoji: string): Promise<unknown>;
}

export async function handleContentReaction(
  message: ContentReactionMessage,
  apiService: Pick<
    MarquinhosApiService,
    'chooseEmojiReactions'
  > = MarquinhosApiService.getInstance(),
): Promise<void> {
  if (!isAiChannel(message)) return;

  try {
    const response = await apiService.chooseEmojiReactions({
      content: message.content,
    });
    const emojis = response.data?.emojis ?? [];

    for (const emoji of emojis) {
      try {
        await message.react(emoji);
      } catch (error) {
        logger.error(`Failed to react with ${emoji}:`, error);
      }
    }
  } catch (error) {
    logger.error('Error choosing emoji reactions:', error);
  }
}
