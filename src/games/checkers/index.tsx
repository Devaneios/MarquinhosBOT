import { CheckersRoomBoard } from './components';
import type { GameDescriptor } from '../registry';
import { checkersRoutes } from './checkersRoutes';

export const gameDescriptor: GameDescriptor = {
  id: 'checkers',
  status: 'PLAY',
  routes: checkersRoutes,
  renderRoomBoard: () => <CheckersRoomBoard />,
};
