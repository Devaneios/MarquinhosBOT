import type { GameDescriptor } from '@/games/GameDescriptor';
import { checkersRoutes } from './checkersRoutes';
import { CheckersRoomBoard } from './components/index';

export const gameDescriptor: GameDescriptor = {
  id: 'checkers',
  status: 'PLAY',
  routes: checkersRoutes,
  renderRoomBoard: () => <CheckersRoomBoard />,
};
