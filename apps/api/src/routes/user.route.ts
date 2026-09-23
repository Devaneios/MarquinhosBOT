import UserController from 'controllers/user.controller';
import express, { type RequestHandler } from 'express';
import { checkToken } from 'middlewares/botAuth';
import { verifyDiscordToken } from 'middlewares/userAuth';

export function createUserRouter(
  userController = new UserController(),
  userAuth: RequestHandler = verifyDiscordToken,
  botAuth: RequestHandler = checkToken,
) {
  const router = express.Router();

  router.get(
    '/profile',
    userAuth,
    userController.getProfile.bind(userController),
  );
  router.get(
    '/exists/:id',
    userAuth,
    userController.exists.bind(userController),
  );
  router.get(
    '/lastfm-status',
    userAuth,
    userController.lastfmStatus.bind(userController),
  );
  router.post(
    '/enable-lastfm',
    userAuth,
    userController.enableLastfm.bind(userController),
  );
  router.delete(
    '/lastfm',
    userAuth,
    userController.deleteLastfmData.bind(userController),
  );
  router.delete(
    '/',
    userAuth,
    userController.deleteAllData.bind(userController),
  );
  router.patch(
    '/toggle-scrobble',
    userAuth,
    userController.toggleScrobbles.bind(userController),
  );
  router.get(
    '/top-artists/:period/:id',
    botAuth,
    userController.getTopArtists.bind(userController),
  );
  router.get(
    '/top-albums/:period/:id',
    botAuth,
    userController.getTopAlbums.bind(userController),
  );
  router.get(
    '/top-tracks/:period/:id',
    botAuth,
    userController.getTopTracks.bind(userController),
  );

  return router;
}

export default createUserRouter();
