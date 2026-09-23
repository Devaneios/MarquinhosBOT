import type { Request, Response } from 'express';
import { emojiReactionChooseSchema } from 'schemas/emojiReaction.schema';
import { EmojiReactionService } from 'services/aiChat/EmojiReactionService';
import { logger } from 'utils/logger';

class EmojiReactionController {
  private service: EmojiReactionService;

  constructor(service: EmojiReactionService = new EmojiReactionService()) {
    this.service = service;
  }

  async choose(req: Request, res: Response) {
    try {
      const body = emojiReactionChooseSchema.shape.body.safeParse(req.body);
      if (!body.success) {
        return res.status(400).json({ message: 'Validation failed' });
      }
      const { content, recentMessages } = body.data;

      const emojis = await this.service.chooseReactions({
        content,
        recentMessages,
      });

      return res.status(200).json({ data: { emojis } });
    } catch (error) {
      logger.error('emoji_reaction.controller.choose_failed', { error });
      return res.status(500).json({ message: 'Unknown Error' });
    }
  }
}

export default EmojiReactionController;
