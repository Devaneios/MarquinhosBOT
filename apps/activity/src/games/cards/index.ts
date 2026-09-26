import type { GameDescriptor } from '@/games/GameDescriptor';
import { cardsRoutes } from './cardsRoutes';

export const gameDescriptor: GameDescriptor = {
  id: 'cards',
  status: 'PLAY',
  routes: cardsRoutes,
};
