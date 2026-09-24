import type { GameDescriptor } from '../GameDescriptor';
import { cardsRoutes } from './cardsRoutes';

export const gameDescriptor: GameDescriptor = {
  id: 'cards',
  status: 'PLAY',
  routes: cardsRoutes,
};
