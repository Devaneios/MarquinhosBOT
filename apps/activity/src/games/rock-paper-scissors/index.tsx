import type { GameDescriptor } from '../GameDescriptor';
import { RpsRoomBoard } from './components/index';
import { rpsRoutes } from './rpsRoutes';

export const gameDescriptor: GameDescriptor = {
  id: 'rock-paper-scissors',
  status: 'PLAY',
  routes: rpsRoutes,
  renderRoomBoard: () => <RpsRoomBoard />,
};
