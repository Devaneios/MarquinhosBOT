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
    if (!message.guild) return;

    try {
      await spamModerationService.handleMessage(message);
    } catch (error) {
      logger.error('Error in spam moderation listener:', error);
    }
  }
}
