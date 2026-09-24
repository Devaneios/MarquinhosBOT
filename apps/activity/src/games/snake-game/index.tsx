import type { GameDescriptor } from '../GameDescriptor';
import { SnakeRoomBoard } from './components/index';
import { snakeRoutes } from './snakeRoutes';

export const gameDescriptor: GameDescriptor = {
  id: 'snake-game',
  status: 'PLAY',
  routes: snakeRoutes,
  renderRoomBoard: () => <SnakeRoomBoard />,
};
