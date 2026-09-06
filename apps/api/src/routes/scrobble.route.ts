import ScrobbleController from 'controllers/scrobble.controller';
import express from 'express';
import { checkToken } from 'middlewares/botAuth';
import { validateRequest } from 'middlewares/validateRequest';
import { addScrobbleToQueueSchema } from 'schemas/scrobble.schema';

const router = express.Router();
const scrobbleController = new ScrobbleController();

router.post(
  '/queue',
  checkToken,
  validateRequest(addScrobbleToQueueSchema),
  scrobbleController.addScrobbleToQueue.bind(
    scrobbleController,
  ) as unknown as express.RequestHandler,
);

router.post(
  '/:id',
  checkToken,
  scrobbleController.dispatchScrobble.bind(
    scrobbleController,
  ) as unknown as express.RequestHandler,
);

router.delete(
  '/:scrobbleId/:userId',
  checkToken,
  scrobbleController.removeUserFromScrobble.bind(
    scrobbleController,
  ) as unknown as express.RequestHandler,
);

router.post(
  '/:scrobbleId/:userId',
  checkToken,
  scrobbleController.addUserToScrobble.bind(
    scrobbleController,
  ) as unknown as express.RequestHandler,
);

export default router;
