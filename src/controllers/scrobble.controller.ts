import type { Request, Response } from 'express';
import { ScrobblerService } from 'services/scrobbler';

interface IdParams {
  id: string;
}

interface ScrobbleUserParams {
  scrobbleId: string;
  userId: string;
}

class ScrobbleController {
  scrobblerService: ScrobblerService;

  constructor() {
    this.scrobblerService = new ScrobblerService();
  }

  async addScrobbleToQueue(req: Request, res: Response) {
    try {
      const data = await this.scrobblerService.addScrobbleToQueue(
        req.body.playbackData,
      );
      return res.status(200).json({ data, message: 'Scrobble added to queue' });
    } catch (error: unknown) {
      console.error(error);
      return res.status(500).json({ message: 'Unknown Error' });
    }
  }

  async dispatchScrobble(
    req: Request<IdParams, Record<string, unknown>, Record<string, unknown>>,
    res: Response,
  ) {
    try {
      const id = await this.scrobblerService.dispatchScrobble(req.params.id);
      return res.status(200).json({ data: id, message: 'Scrobbled' });
    } catch (error: unknown) {
      console.error(error);
      return res.status(500).json({ message: 'Unknown Error' });
    }
  }

  async removeUserFromScrobble(
    req: Request<
      ScrobbleUserParams,
      Record<string, unknown>,
      Record<string, unknown>
    >,
    res: Response,
  ) {
    try {
      const id = await this.scrobblerService.removeUserFromScrobble(
        req.params.scrobbleId,
        req.params.userId,
      );
      return res.status(200).json({ data: id, message: 'User removed' });
    } catch (error: unknown) {
      console.error(error);
      return res.status(500).json({ message: 'Unknown Error' });
    }
  }

  async addUserToScrobble(
    req: Request<
      ScrobbleUserParams,
      Record<string, unknown>,
      Record<string, unknown>
    >,
    res: Response,
  ) {
    try {
      const id = await this.scrobblerService.addUserToScrobble(
        req.params.scrobbleId,
        req.params.userId,
      );
      return res.status(200).json({ data: id, message: 'User removed' });
    } catch (error: unknown) {
      console.error(error);
      return res.status(500).json({ message: 'Unknown Error' });
    }
  }
}

export default ScrobbleController;
