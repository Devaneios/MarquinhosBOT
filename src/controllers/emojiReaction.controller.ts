import type { Request, Response } from 'express';
import { EmojiReactionService } from 'services/aiChat/EmojiReactionService';
import { logger } from 'utils/logger';

class EmojiReactionController {
  private service: EmojiReactionService;

  constructor(service: EmojiReactionService = new EmojiReactionService()) {
    this.service = service;
  }

  async choose(req: Request, res: Response) {
    try {
      const { content, recentMessages } = req.body as {
        content: string;
        recentMessages?: { author: string; content: string }[];
      };

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
