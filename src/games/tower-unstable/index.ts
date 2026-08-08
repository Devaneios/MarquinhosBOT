import type { GameDescriptor } from '../registry';
import { towerRoutes } from './towerRoutes';

export const gameDescriptor: GameDescriptor = {
  id: 'tower-unstable',
  name: 'UNSTABLE TOWER',
  status: 'PLAY',
  routes: towerRoutes,
};
