import type { GameDescriptor } from '../registry';
import { dominoesBlockRoutes } from './dominoesBlockRoutes';

export const gameDescriptor: GameDescriptor = {
  id: 'dominoes-block' as GameDescriptor['id'],
  name: 'DOMINOES',
  status: 'PLAY',
  routes: dominoesBlockRoutes,
};
