import type { GameDescriptor } from '../registry';
import { TowerRoomBoard } from './components';
import { towerRoutes } from './towerRoutes';

export const gameDescriptor: GameDescriptor = {
  id: 'tower-unstable',
  status: 'PLAY',
  routes: towerRoutes,
  renderRoomBoard: () => <TowerRoomBoard />,
};
