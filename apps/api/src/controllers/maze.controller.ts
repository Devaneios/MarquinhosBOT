import type { Request, Response } from 'express';
import {
  abandonMazeBodySchema,
  MAZE_DIRECTIONS,
  MAZE_MODES,
  MAZE_SIZES,
  mazeSessionParamsSchema,
  moveMazeBodySchema,
  startMazeBodySchema,
} from 'schemas/maze.schema';
import { MazeService } from 'services/maze';

export class MazeController {
  private service = new MazeService();

  startMaze(req: Request, res: Response) {
    try {
      const body = startMazeBodySchema.safeParse(req.body);
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
      const data = this.service.createMazeSession(userId, guildId, mode, size);
      return res.status(200).json({ data });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Unknown Error' });
    }
  }

  moveMaze(req: Request, res: Response) {
    try {
      const params = mazeSessionParamsSchema.safeParse(req.params);
      if (!params.success) {
        return res.status(400).json({ message: 'sessionId is required' });
      }
      const body = moveMazeBodySchema.safeParse(req.body);
      if (!body.success) {
        const message =
          body.error.issues[0]?.path[0] === 'direction'
            ? `direction must be one of: ${MAZE_DIRECTIONS.join(', ')}`
            : 'userId is required';
        return res.status(400).json({ message });
      }

      const data = this.service.processMazeMove(
        params.data.sessionId,
        body.data.userId,
        body.data.direction,
      );
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

  getMaze(req: Request, res: Response) {
    try {
      const params = mazeSessionParamsSchema.safeParse(req.params);
      if (!params.success) {
        return res.status(400).json({ message: 'sessionId is required' });
      }
      const data = this.service.getMazeSession(params.data.sessionId);
      if (data === null) {
        return res.status(404).json({ message: 'Maze session not found' });
      }
      return res.status(200).json({ data });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Unknown Error' });
    }
  }

  abandonMaze(req: Request, res: Response) {
    try {
      const params = mazeSessionParamsSchema.safeParse(req.params);
      if (!params.success) {
        return res.status(400).json({ message: 'sessionId is required' });
      }
      const body = abandonMazeBodySchema.safeParse(req.body);
      if (!body.success) {
        return res.status(400).json({ message: 'userId is required' });
      }

      this.service.abandonMazeSession(params.data.sessionId, body.data.userId);
      return res.status(200).json({ message: 'Maze session abandoned' });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Unknown Error' });
    }
  }
}
