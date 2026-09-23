import * as contract from '@marquinhos/contracts/http/routes/scrobble';
import ScrobbleController from 'controllers/scrobble.controller';
import express from 'express';
import { checkToken } from 'middlewares/botAuth';
import { validateContract } from 'utils/contract';

const router = express.Router();
const scrobbleController = new ScrobbleController();

router.post(
  '/queue',
  checkToken,
  validateContract(contract.addToQueue),
  scrobbleController.addScrobbleToQueue.bind(scrobbleController),
);

router.post(
  '/:id',
  checkToken,
  scrobbleController.dispatchScrobble.bind(scrobbleController),
);

router.delete(
  '/:scrobbleId/:userId',
  checkToken,
  scrobbleController.removeUserFromScrobble.bind(scrobbleController),
);

router.post(
  '/:scrobbleId/:userId',
  checkToken,
  scrobbleController.addUserToScrobble.bind(scrobbleController),
);

export default router;
