import * as contract from '@marquinhos/contracts/http/routes/aiChat';
import AiChatController from 'controllers/aiChat.controller';
import express from 'express';
import { checkToken } from 'middlewares/botAuth';
import { validateContract } from 'utils/contract';

export function createAiChatRouter(aiChat = new AiChatController()) {
  const router = express.Router();

  router.post(
    '/respond',
    checkToken,
    validateContract(contract.respond),
    aiChat.respond.bind(aiChat),
  );

  router.post(
    '/thread/ask',
    checkToken,
    validateContract(contract.askInThread),
    aiChat.askInThread.bind(aiChat),
  );

  router.post(
    '/research',
    checkToken,
    validateContract(contract.startResearch),
    aiChat.startResearch.bind(aiChat),
  );

  router.get(
    '/research/:jobId',
    checkToken,
    aiChat.getResearchJob.bind(aiChat),
  );

  router.get('/traces', checkToken, aiChat.listTraces.bind(aiChat));

  router.get('/traces/:traceId', checkToken, aiChat.getTrace.bind(aiChat));

  return router;
}

export default createAiChatRouter();
