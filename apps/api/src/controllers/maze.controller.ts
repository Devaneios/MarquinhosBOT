import * as contract from '@marquinhos/contracts/http/routes/maze';
import {
  MAZE_DIRECTIONS,
  MAZE_MODES,
  MAZE_SIZES,
} from '@marquinhos/contracts/http/routes/maze';
import type { Request, Response } from 'express';
import { MazeService } from 'services/maze';
import { sendContract } from 'utils/contract';

export class MazeController {
  private service = new MazeService();

  async startMaze(req: Request, res: Response) {
    try {
      const body = contract.startMaze.body.safeParse(req.body);
      if (!body.success) {
        const field = body.error.issues[0]?.path[0];
        const message =
          field === 'mode'
            ? `mode must be one of: ${MAZE_MODES.join(', ')}`
            : field === 'size'
              ? `size must be one of: ${MAZE_SIZES.join(', ')}`
              : 'userId and guildId are required';
        return res.status(400).json({ message });
      }

      const { userId, guildId, mode, size } = body.data;
      const data = await this.service.createMazeSession(
        userId,
        guildId,
        mode,
        size,
      );
      return sendContract(res, contract.startMaze, { data });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Unknown Error' });
    }
  }

  async moveMaze(req: Request, res: Response) {
    try {
      const params = contract.getMaze.params.safeParse(req.params);
      if (!params.success) {
        return res.status(400).json({ message: 'sessionId is required' });
      }
      const body = contract.moveMaze.body.safeParse(req.body);
      if (!body.success) {
        const message =
          body.error.issues[0]?.path[0] === 'direction'
            ? `direction must be one of: ${MAZE_DIRECTIONS.join(', ')}`
            : 'userId is required';
        return res.status(400).json({ message });
      }

      const data = await this.service.processMazeMove(
        params.data.sessionId,
        body.data.userId,
        body.data.direction,
      );
      if (data === null) {
        return res
          .status(404)
          .json({ message: 'Maze session not found or not active' });
      }
      return sendContract(res, contract.moveMaze, { data });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Unknown Error' });
    }
  }

  async getMaze(req: Request, res: Response) {
    try {
      const params = contract.getMaze.params.safeParse(req.params);
      if (!params.success) {
        return res.status(400).json({ message: 'sessionId is required' });
      }
      const data = await this.service.getMazeSession(params.data.sessionId);
      if (data === null) {
        return res.status(404).json({ message: 'Maze session not found' });
      }
      return sendContract(res, contract.getMaze, { data });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Unknown Error' });
    }
  }

  async abandonMaze(req: Request, res: Response) {
    try {
      const params = contract.getMaze.params.safeParse(req.params);
      if (!params.success) {
        return res.status(400).json({ message: 'sessionId is required' });
      }
      const body = contract.abandonMaze.body.safeParse(req.body);
      if (!body.success) {
        return res.status(400).json({ message: 'userId is required' });
      }

      await this.service.abandonMazeSession(
        params.data.sessionId,
        body.data.userId,
      );
      return sendContract(res, contract.abandonMaze, {
        message: 'Maze session abandoned',
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Unknown Error' });
    }
  }
}
