import type { GameDescriptor } from '../registry';
import { battleshipRoutes } from './battleshipRoutes';
import { BattleshipRoomBoard } from './components';

export const gameDescriptor: GameDescriptor = {
  id: 'battleship',
  status: 'PLAY',
  routes: battleshipRoutes,
  renderRoomBoard: () => <BattleshipRoomBoard />,
};
