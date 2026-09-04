import { SnakeRoomBoard } from './components';
import type { GameDescriptor } from '../registry';
import { snakeRoutes } from './snakeRoutes';

export const gameDescriptor: GameDescriptor = {
  id: 'snake-game',
  status: 'PLAY',
  routes: snakeRoutes,
  renderRoomBoard: () => <SnakeRoomBoard />,
};
