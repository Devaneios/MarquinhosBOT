import ActivityController from 'controllers/activity.controller';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { checkToken } from 'middlewares/botAuth';
import { validateRequest } from 'middlewares/validateRequest';
import {
  activityCreateRoomSchema,
  activityDeepLinkClaimSchema,
  activityDeepLinkRecordSchema,
  activityListRoomsSchema,
  activityTokenExchangeSchema,
  activityWsSessionSchema,
  pongLeaderboardSchema,
  pongTournamentCreateSchema,
  pongTournamentListSchema,
  pongTournamentReportSchema,
} from 'schemas/activity.schema';

const router = express.Router();
const activity = new ActivityController();

// Called directly by the untrusted iframe client before any session exists,
// so it can't use checkToken (bot key or already-authenticated user token).
const activityLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
});

router.post(
  '/token',
  activityLimiter,
  validateRequest(activityTokenExchangeSchema),
  activity.exchangeToken,
);
router.post(
  '/ws-session',
  activityLimiter,
  validateRequest(activityWsSessionSchema),
  activity.getWsSessionToken,
);
router.post(
  '/pong/leaderboard',
  activityLimiter,
  validateRequest(pongLeaderboardSchema),
  activity.getPongLeaderboard,
);
router.post(
  '/pong/tournaments/create',
  activityLimiter,
  validateRequest(pongTournamentCreateSchema),
  activity.createPongTournament,
);
router.post(
  '/pong/tournaments/list',
  activityLimiter,
  validateRequest(pongTournamentListSchema),
  activity.listPongTournaments,
);
router.post(
  '/pong/tournaments/report',
  activityLimiter,
  validateRequest(pongTournamentReportSchema),
  activity.reportPongTournamentMatch,
);
router.post(
  '/deep-link',
  checkToken,
  validateRequest(activityDeepLinkRecordSchema),
  activity.recordDeepLinkIntent,
);
router.post(
  '/deep-link/claim',
  activityLimiter,
  validateRequest(activityDeepLinkClaimSchema),
  activity.claimDeepLinkIntent,
);
router.post(
  '/rooms',
  activityLimiter,
  validateRequest(activityCreateRoomSchema),
  activity.createRoom,
);
router.post(
  '/rooms/list',
  activityLimiter,
  validateRequest(activityListRoomsSchema),
  activity.listRooms,
);

export default router;
