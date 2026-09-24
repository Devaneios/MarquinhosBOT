import * as contract from '@marquinhos/contracts/http/routes/scrobble';
import type { Request, Response } from 'express';
import { ScrobblerService } from 'services/scrobbler';
import { parseRequest, sendContract } from 'utils/contract';
import { logger } from 'utils/logger';

class ScrobbleController {
  scrobblerService: ScrobblerService;

  constructor() {
    this.scrobblerService = new ScrobblerService();
  }

  async addScrobbleToQueue(req: Request, res: Response) {
    try {
      const input = parseRequest(contract.addToQueue, req);
      if (!input) {
        return res.status(400).json({ message: 'Invalid playback data' });
      }
      const data = await this.scrobblerService.addScrobbleToQueue(
        input.body.playbackData,
      );
      return sendContract(res, contract.addToQueue, {
        data,
        message: 'Scrobble added to queue',
      });
    } catch (error: unknown) {
      logger.error('scrobble.controller.add_scrobble_to_queue_failed', {
        error,
      });
      return res.status(500).json({ message: 'Unknown Error' });
    }
  }

  async dispatchScrobble(req: Request, res: Response) {
    try {
      const input = parseRequest(contract.dispatch, req);
      if (!input) {
        return res.status(400).json({ message: 'id is required' });
      }
      const id = await this.scrobblerService.dispatchScrobble(input.params.id);
      return sendContract(res, contract.dispatch, {
        data: id,
        message: 'Scrobbled',
      });
    } catch (error: unknown) {
      logger.error('scrobble.controller.dispatch_scrobble_failed', { error });
      return res.status(500).json({ message: 'Unknown Error' });
    }
  }

  async removeUserFromScrobble(req: Request, res: Response) {
    try {
      const input = parseRequest(contract.removeUser, req);
      if (!input) {
        return res
          .status(400)
          .json({ message: 'scrobbleId and userId are required' });
      }
      const id = await this.scrobblerService.removeUserFromScrobble(
        input.params.scrobbleId,
        input.params.userId,
      );
      return sendContract(res, contract.removeUser, {
        data: id,
        message: 'User removed',
      });
    } catch (error: unknown) {
      logger.error('scrobble.controller.remove_user_from_scrobble_failed', {
        error,
      });
      return res.status(500).json({ message: 'Unknown Error' });
    }
  }

  async addUserToScrobble(req: Request, res: Response) {
    try {
      const input = parseRequest(contract.addUser, req);
      if (!input) {
        return res
          .status(400)
          .json({ message: 'scrobbleId and userId are required' });
      }
      const id = await this.scrobblerService.addUserToScrobble(
        input.params.scrobbleId,
        input.params.userId,
      );
      return sendContract(res, contract.addUser, {
        data: id,
        message: 'User added',
      });
    } catch (error: unknown) {
      logger.error('scrobble.controller.add_user_to_scrobble_failed', {
        error,
      });
      return res.status(500).json({ message: 'Unknown Error' });
    }
  }
}

export default ScrobbleController;
