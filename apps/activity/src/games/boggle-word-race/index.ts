import type { GameDescriptor } from '../registry';
import { boggleRoutes } from './boggleRoutes';

export const gameDescriptor: GameDescriptor = {
  id: 'boggle-word-race',
  status: 'PLAY',
  routes: boggleRoutes,
};
