import type { GameDescriptor } from '@/games/GameDescriptor';
import { boggleRoutes } from './boggleRoutes';

export const gameDescriptor: GameDescriptor = {
  id: 'boggle-word-race',
  status: 'PLAY',
  routes: boggleRoutes,
};
