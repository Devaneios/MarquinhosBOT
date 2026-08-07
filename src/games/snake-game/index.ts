import type { GameDescriptor } from '../registry';
import { snakeRoutes } from './snakeRoutes';

export const gameDescriptor = {
  id: 'snake-game',
  name: 'SNAKE GAME',
  status: 'PLAY' as const,
  routes: snakeRoutes,
} as unknown as GameDescriptor;
