import type { GameDescriptor } from '../registry';
import { dominoesBlockRoutes } from './dominoesBlockRoutes';

export const gameDescriptor: GameDescriptor = {
  id: 'dominoes-block' as GameDescriptor['id'],
  status: 'PLAY',
  routes: dominoesBlockRoutes,
};
