import type { GameDescriptor } from '../registry';
import { pongRoutes } from './pongRoutes';

export const gameDescriptor: GameDescriptor = {
  id: 'pong',
  name: 'PONGUINHOS',
  status: 'PLAY',
  routes: pongRoutes,
};
