import type { GameDescriptor } from '@/games/GameDescriptor';
import { pongRoutes } from './pongRoutes';

export const gameDescriptor: GameDescriptor = {
  id: 'pong',
  status: 'PLAY',
  routes: pongRoutes,
};
