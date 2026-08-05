import type { GameDescriptor } from '../registry';
import { cardsRoutes } from './cardsRoutes';

export const gameDescriptor: GameDescriptor = {
  id: 'cards',
  name: 'CARD TABLE',
  status: 'COMING SOON',
  routes: cardsRoutes,
};
