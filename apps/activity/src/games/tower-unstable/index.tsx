import type { GameDescriptor } from '../GameDescriptor';
import { TowerRoomBoard } from './components/index';
import { towerRoutes } from './towerRoutes';

export const gameDescriptor: GameDescriptor = {
  id: 'tower-unstable',
  status: 'PLAY',
  routes: towerRoutes,
  renderRoomBoard: () => <TowerRoomBoard />,
};
