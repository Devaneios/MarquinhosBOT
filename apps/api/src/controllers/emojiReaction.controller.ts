import * as contract from '@marquinhos/contracts/http/routes/emojiReaction';
import type { Request, Response } from 'express';
import { EmojiReactionService } from 'services/aiChat/EmojiReactionService';
import { parseRequest, sendContract } from 'utils/contract';
import { logger } from 'utils/logger';

class EmojiReactionController {
  private service: EmojiReactionService;

  constructor(service: EmojiReactionService = new EmojiReactionService()) {
    this.service = service;
  }

  async choose(req: Request, res: Response) {
    try {
      const input = parseRequest(contract.choose, req);
      if (!input) {
        return res.status(400).json({ message: 'Validation failed' });
      }
      const { content, recentMessages } = input.body;

      const emojis = await this.service.chooseReactions({
        content,
        recentMessages,
      });

      return sendContract(res, contract.choose, { data: { emojis } });
    } catch (error) {
      logger.error('emoji_reaction.controller.choose_failed', { error });
      return res.status(500).json({ message: 'Unknown Error' });
    }
  }
}

export default EmojiReactionController;
