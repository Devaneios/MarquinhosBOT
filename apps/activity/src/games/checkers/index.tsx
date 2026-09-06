import type { GameDescriptor } from '../registry';
import { checkersRoutes } from './checkersRoutes';
import { CheckersRoomBoard } from './components';

export const gameDescriptor: GameDescriptor = {
  id: 'checkers',
  status: 'PLAY',
  routes: checkersRoutes,
  renderRoomBoard: () => <CheckersRoomBoard />,
};
