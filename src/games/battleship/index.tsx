import { BattleshipRoomBoard } from './components';
import type { GameDescriptor } from '../registry';
import { battleshipRoutes } from './battleshipRoutes';

export const gameDescriptor: GameDescriptor = {
  id: 'battleship',
  status: 'PLAY',
  routes: battleshipRoutes,
  renderRoomBoard: () => <BattleshipRoomBoard />,
};
