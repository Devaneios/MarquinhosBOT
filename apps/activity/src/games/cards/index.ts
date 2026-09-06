import type { GameDescriptor } from '../registry';
import { cardsRoutes } from './cardsRoutes';

export const gameDescriptor: GameDescriptor = {
  id: 'cards',
  status: 'PLAY',
  routes: cardsRoutes,
};
