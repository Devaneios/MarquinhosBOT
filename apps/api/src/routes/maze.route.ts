import { MazeController } from 'controllers/maze.controller';
import express from 'express';
import { checkToken } from 'middlewares/botAuth';

const router = express.Router();
const maze = new MazeController();

router.post(
  '/start',
  checkToken,
  maze.startMaze.bind(maze) as unknown as express.RequestHandler,
);
router.post(
  '/:sessionId/move',
  checkToken,
  maze.moveMaze.bind(maze) as unknown as express.RequestHandler,
);
router.get(
  '/:sessionId',
  checkToken,
  maze.getMaze.bind(maze) as unknown as express.RequestHandler,
);
router.delete(
  '/:sessionId',
  checkToken,
  maze.abandonMaze.bind(maze) as unknown as express.RequestHandler,
);

export default router;
