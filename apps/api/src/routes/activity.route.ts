import * as contract from '@marquinhos/contracts/http/routes/activity';
import ActivityController from 'controllers/activity.controller';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { checkToken } from 'middlewares/botAuth';
import { validateContract } from 'utils/contract';

// Called directly by the untrusted iframe client before any session exists,
// so it can't use checkToken (bot key or already-authenticated user token).
const activityLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
});

export function createActivityRouter(activity = new ActivityController()) {
  const router = express.Router();

  router.post(
    '/token',
    activityLimiter,
    validateContract(contract.exchangeToken),
    activity.exchangeToken,
  );
  router.post(
    '/ws-session',
    activityLimiter,
    validateContract(contract.wsSession),
    activity.getWsSessionToken,
  );
  router.post(
    '/pong/leaderboard',
    activityLimiter,
    validateContract(contract.pongLeaderboard),
    activity.getPongLeaderboard,
  );
  router.post(
    '/pong/tournaments/create',
    activityLimiter,
    validateContract(contract.createPongTournament),
    activity.createPongTournament,
  );
  router.post(
    '/pong/tournaments/list',
    activityLimiter,
    validateContract(contract.listPongTournaments),
    activity.listPongTournaments,
  );
  router.post(
    '/pong/tournaments/report',
    activityLimiter,
    validateContract(contract.reportPongTournamentMatch),
    activity.reportPongTournamentMatch,
  );
  router.post(
    '/deep-link',
    checkToken,
    validateContract(contract.recordDeepLink),
    activity.recordDeepLinkIntent,
  );
  router.post(
    '/deep-link/claim',
    activityLimiter,
    validateContract(contract.claimDeepLink),
    activity.claimDeepLinkIntent,
  );
  router.post(
    '/rooms',
    activityLimiter,
    validateContract(contract.createRoom),
    activity.createRoom,
  );
  router.post(
    '/rooms/list',
    activityLimiter,
    validateContract(contract.listRooms),
    activity.listRooms,
  );

  return router;
}

export default createActivityRouter();
