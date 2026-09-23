import * as contract from '@marquinhos/contracts/http/routes/emojiReaction';
import EmojiReactionController from 'controllers/emojiReaction.controller';
import express from 'express';
import { checkToken } from 'middlewares/botAuth';
import { validateContract } from 'utils/contract';

export function createEmojiReactionRouter(
  emojiReaction = new EmojiReactionController(),
) {
  const router = express.Router();

  router.post(
    '/choose',
    checkToken,
    validateContract(contract.choose),
    emojiReaction.choose.bind(emojiReaction),
  );

  return router;
}

export default createEmojiReactionRouter();
