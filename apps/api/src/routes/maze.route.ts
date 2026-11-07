import express from 'express';
import { checkToken } from 'middlewares/botAuth';
import { MazeController } from 'modules/maze/maze.controller';

const router = express.Router();
const maze = new MazeController();

router.post('/start', checkToken, maze.startMaze.bind(maze));
router.post('/:sessionId/move', checkToken, maze.moveMaze.bind(maze));
router.get('/:sessionId', checkToken, maze.getMaze.bind(maze));
router.delete('/:sessionId', checkToken, maze.abandonMaze.bind(maze));

export default router;
