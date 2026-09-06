import AiChatController from 'controllers/aiChat.controller';
import express from 'express';
import { checkToken } from 'middlewares/botAuth';
import { validateRequest } from 'middlewares/validateRequest';
import {
  aiChatRespondSchema,
  aiResearchStartSchema,
  aiThreadAskSchema,
} from 'schemas/aiChat.schema';

const router = express.Router();
const aiChat = new AiChatController();

router.post(
  '/respond',
  checkToken,
  validateRequest(aiChatRespondSchema),
  aiChat.respond.bind(aiChat) as unknown as express.RequestHandler,
);

router.post(
  '/thread/ask',
  checkToken,
  validateRequest(aiThreadAskSchema),
  aiChat.askInThread.bind(aiChat) as unknown as express.RequestHandler,
);

router.post(
  '/research',
  checkToken,
  validateRequest(aiResearchStartSchema),
  aiChat.startResearch.bind(aiChat) as unknown as express.RequestHandler,
);

router.get(
  '/research/:jobId',
  checkToken,
  aiChat.getResearchJob.bind(aiChat) as unknown as express.RequestHandler,
);

router.get(
  '/traces',
  checkToken,
  aiChat.listTraces.bind(aiChat) as unknown as express.RequestHandler,
);

router.get(
  '/traces/:traceId',
  checkToken,
  aiChat.getTrace.bind(aiChat) as unknown as express.RequestHandler,
);

export default router;
