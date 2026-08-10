import type { GameDescriptor } from '../registry';
import { snakeRoutes } from './snakeRoutes';

export const gameDescriptor = {
  id: 'snake-game',
  status: 'PLAY' as const,
  routes: snakeRoutes,
} as unknown as GameDescriptor;
