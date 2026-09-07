import type { Request, Response } from 'express';
import { MazeService } from 'services/maze';

const VALID_SIZES = [15, 31, 51, 99];
const VALID_MODES = ['open', 'foggy'];
const VALID_DIRECTIONS = ['up', 'down', 'left', 'right'];

interface SessionIdParams {
  sessionId: string;
}

export class MazeController {
  private service = new MazeService();

  startMaze(req: Request, res: Response) {
    try {
      const { userId, guildId, mode, size } = req.body as {
        userId: string;
        guildId: string;
        mode: string;
        size: number;
      };

      if (!userId || !guildId) {
        return res
          .status(400)
          .json({ message: 'userId and guildId are required' });
      }
      if (!VALID_MODES.includes(mode)) {
        return res
          .status(400)
          .json({ message: `mode must be one of: ${VALID_MODES.join(', ')}` });
      }
      if (!VALID_SIZES.includes(Number(size))) {
        return res
          .status(400)
          .json({ message: `size must be one of: ${VALID_SIZES.join(', ')}` });
      }

      const data = this.service.createMazeSession(
        userId,
        guildId,
        mode as 'open' | 'foggy',
        Number(size),
      );
      return res.status(200).json({ data });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Unknown Error' });
    }
  }

  moveMaze(
    req: Request<
      SessionIdParams,
      Record<string, unknown>,
      Record<string, unknown>
    >,
    res: Response,
  ) {
    try {
      const { sessionId } = req.params;
      const { userId, direction } = req.body as {
        userId: string;
        direction: string;
      };

      if (!userId) {
        return res.status(400).json({ message: 'userId is required' });
      }
      if (!VALID_DIRECTIONS.includes(direction)) {
        return res.status(400).json({
          message: `direction must be one of: ${VALID_DIRECTIONS.join(', ')}`,
        });
      }

      const data = this.service.processMazeMove(sessionId, userId, direction);
      if (data === null) {
        return res
          .status(404)
          .json({ message: 'Maze session not found or not active' });
      }
      return res.status(200).json({ data });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Unknown Error' });
    }
  }

  getMaze(
    req: Request<
      SessionIdParams,
      Record<string, unknown>,
      Record<string, unknown>
    >,
    res: Response,
  ) {
    try {
      const { sessionId } = req.params;
      const data = this.service.getMazeSession(sessionId);
      if (data === null) {
        return res.status(404).json({ message: 'Maze session not found' });
      }
      return res.status(200).json({ data });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Unknown Error' });
    }
  }

  abandonMaze(
    req: Request<
      SessionIdParams,
      Record<string, unknown>,
      Record<string, unknown>
    >,
    res: Response,
  ) {
    try {
      const { sessionId } = req.params;
      const { userId } = req.body as { userId: string };

      if (!userId) {
        return res.status(400).json({ message: 'userId is required' });
      }

      this.service.abandonMazeSession(sessionId, userId);
      return res.status(200).json({ message: 'Maze session abandoned' });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Unknown Error' });
    }
  }
}
