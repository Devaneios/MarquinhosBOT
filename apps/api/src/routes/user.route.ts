import UserController from 'controllers/user.controller';
import express from 'express';
import { checkToken } from 'middlewares/botAuth';
import { verifyDiscordToken } from 'middlewares/userAuth';

const router = express.Router();
const userController = new UserController();

router.get(
  '/profile',
  verifyDiscordToken,
  userController.getProfile.bind(
    userController,
  ) as unknown as express.RequestHandler,
);
router.get(
  '/exists/:id',
  verifyDiscordToken,
  userController.exists.bind(
    userController,
  ) as unknown as express.RequestHandler,
);
router.get(
  '/lastfm-status',
  verifyDiscordToken,
  userController.lastfmStatus.bind(
    userController,
  ) as unknown as express.RequestHandler,
);
router.post(
  '/enable-lastfm',
  verifyDiscordToken,
  userController.enableLastfm.bind(
    userController,
  ) as unknown as express.RequestHandler,
);
router.delete(
  '/lastfm',
  verifyDiscordToken,
  userController.deleteLastfmData.bind(
    userController,
  ) as unknown as express.RequestHandler,
);
router.delete(
  '/',
  verifyDiscordToken,
  userController.deleteAllData.bind(
    userController,
  ) as unknown as express.RequestHandler,
);
router.patch(
  '/toggle-scrobble',
  verifyDiscordToken,
  userController.toggleScrobbles.bind(
    userController,
  ) as unknown as express.RequestHandler,
);
router.get(
  '/top-artists/:period/:id',
  checkToken,
  userController.getTopArtists.bind(
    userController,
  ) as unknown as express.RequestHandler,
);
router.get(
  '/top-albums/:period/:id',
  checkToken,
  userController.getTopAlbums.bind(
    userController,
  ) as unknown as express.RequestHandler,
);
router.get(
  '/top-tracks/:period/:id',
  checkToken,
  userController.getTopTracks.bind(
    userController,
  ) as unknown as express.RequestHandler,
);

export default router;
