import EmojiReactionController from 'controllers/emojiReaction.controller';
import express from 'express';
import { checkToken } from 'middlewares/botAuth';
import { validateRequest } from 'middlewares/validateRequest';
import { emojiReactionChooseSchema } from 'schemas/emojiReaction.schema';

const router = express.Router();
const emojiReaction = new EmojiReactionController();

router.post(
  '/choose',
  checkToken,
  validateRequest(emojiReactionChooseSchema),
  emojiReaction.choose.bind(emojiReaction) as unknown as express.RequestHandler,
);

export default router;
