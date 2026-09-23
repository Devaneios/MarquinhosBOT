import type { Request, Response } from 'express';
import {
  addScrobbleToQueueSchema,
  scrobbleIdParamsSchema,
  scrobbleUserParamsSchema,
} from 'schemas/scrobble.schema';
import { ScrobblerService } from 'services/scrobbler';

class ScrobbleController {
  scrobblerService: ScrobblerService;

  constructor() {
    this.scrobblerService = new ScrobblerService();
  }

  async addScrobbleToQueue(req: Request, res: Response) {
    try {
      const body = addScrobbleToQueueSchema.shape.body.safeParse(req.body);
      if (!body.success) {
        return res.status(400).json({ message: 'Invalid playback data' });
      }
      const data = await this.scrobblerService.addScrobbleToQueue(
        body.data.playbackData,
      );
      return res.status(200).json({ data, message: 'Scrobble added to queue' });
    } catch (error: unknown) {
      console.error(error);
      return res.status(500).json({ message: 'Unknown Error' });
    }
  }

  async dispatchScrobble(req: Request, res: Response) {
    try {
      const params = scrobbleIdParamsSchema.safeParse(req.params);
      if (!params.success) {
        return res.status(400).json({ message: 'id is required' });
      }
      const id = await this.scrobblerService.dispatchScrobble(params.data.id);
      return res.status(200).json({ data: id, message: 'Scrobbled' });
    } catch (error: unknown) {
      console.error(error);
      return res.status(500).json({ message: 'Unknown Error' });
    }
  }

  async removeUserFromScrobble(req: Request, res: Response) {
    try {
      const params = scrobbleUserParamsSchema.safeParse(req.params);
      if (!params.success) {
        return res
          .status(400)
          .json({ message: 'scrobbleId and userId are required' });
      }
      const id = await this.scrobblerService.removeUserFromScrobble(
        params.data.scrobbleId,
        params.data.userId,
      );
      return res.status(200).json({ data: id, message: 'User removed' });
    } catch (error: unknown) {
      console.error(error);
      return res.status(500).json({ message: 'Unknown Error' });
    }
  }

  async addUserToScrobble(req: Request, res: Response) {
    try {
      const params = scrobbleUserParamsSchema.safeParse(req.params);
      if (!params.success) {
        return res
          .status(400)
          .json({ message: 'scrobbleId and userId are required' });
      }
      const id = await this.scrobblerService.addUserToScrobble(
        params.data.scrobbleId,
        params.data.userId,
      );
      return res.status(200).json({ data: id, message: 'User removed' });
    } catch (error: unknown) {
      console.error(error);
      return res.status(500).json({ message: 'Unknown Error' });
    }
  }
}

export default ScrobbleController;
