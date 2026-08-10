import type { GameDescriptor } from '../registry';
import { rpsRoutes } from './rpsRoutes';

export const gameDescriptor: GameDescriptor = {
  id: 'rock-paper-scissors',
  status: 'PLAY',
  routes: rpsRoutes,
};
