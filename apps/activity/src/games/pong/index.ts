import type { GameDescriptor } from '../GameDescriptor';
import { pongRoutes } from './pongRoutes';

export const gameDescriptor: GameDescriptor = {
  id: 'pong',
  status: 'PLAY',
  routes: pongRoutes,
};
