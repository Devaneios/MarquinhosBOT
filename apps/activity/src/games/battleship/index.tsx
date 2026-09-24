import type { GameDescriptor } from '../GameDescriptor';
import { battleshipRoutes } from './battleshipRoutes';
import { BattleshipRoomBoard } from './components/index';

export const gameDescriptor: GameDescriptor = {
  id: 'battleship',
  status: 'PLAY',
  routes: battleshipRoutes,
  renderRoomBoard: () => <BattleshipRoomBoard />,
};
