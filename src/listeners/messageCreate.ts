import { handleAiThreadMessage } from '@marquinhos/services/aiChat/aiThreadMessage';
import { handleContentReaction } from '@marquinhos/services/aiChat/contentReactions';
import { handleTagResponse } from '@marquinhos/services/aiChat/tagResponse';
import { spamModerationService } from '@marquinhos/services/spamModeration';
import { logger } from '@marquinhos/utils/logger';
import { Listener } from '@sapphire/framework';
import { Events, Message } from 'discord.js';

export class MessageCreateListener extends Listener<
  typeof Events.MessageCreate
> {
  public constructor(context: Listener.LoaderContext) {
    super(context, { event: Events.MessageCreate });
  }

  override async run(message: Message) {
    if (message.author.bot) return;
    if (!message.member) return;
    if (!message.inGuild()) return;

    try {
      await spamModerationService.handleMessage(message);
    } catch (error) {
      logger.error('Error in spam moderation listener:', error);
    }

    // An /ia thread is its own conversation: a message there is a follow-up and
    // must not also go through the tag flow, which would answer it twice.
    try {
      if (await handleAiThreadMessage(message)) return;
    } catch (error) {
      logger.error('Error in AI thread handler:', error);
      return;
    }

    try {
      await handleContentReaction(message);
    } catch (error) {
      logger.error('Error in content reaction handler:', error);
    }

    try {
      await handleTagResponse(message);
    } catch (error) {
      logger.error('Error in tag response handler:', error);
    }
  }
}
