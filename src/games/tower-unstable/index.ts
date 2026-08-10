import type { GameDescriptor } from '../registry';
import { towerRoutes } from './towerRoutes';

export const gameDescriptor: GameDescriptor = {
  id: 'tower-unstable',
  status: 'PLAY',
  routes: towerRoutes,
};
