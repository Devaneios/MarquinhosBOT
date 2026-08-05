import type { GameDescriptor } from '../registry';
import { cardsRoutes } from './cardsRoutes';

export const gameDescriptor: GameDescriptor = {
  id: 'cards',
  name: 'CARD TABLE',
  status: 'PLAY',
  routes: cardsRoutes,
};
